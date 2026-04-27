import type { IpcMainInvokeEvent } from 'electron'
import { ipcMain } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type DatabaseConstructor from 'better-sqlite3'
import { getSecretKey, setSecretKey, clearSecretKey } from './secureStore'
import type { ChatMsg } from './local-llm'
import { testOpenAICompatible } from './ra-llm-providers'
import { cerebralInsertProviderLog, cerebralGetWorkspaceRoot, newCerebralId } from './cerebral-db'
import { CodeFenceFileWriter } from './ra-code-file-export'
import {
  raDeleteAgent,
  raDeleteProvider,
  raDeleteSwarm,
  raEnsureSeed,
  raGetAgent,
  raGetProvider,
  raGetSession,
  raGetSwarm,
  raInsertMessage,
  raInsertMemory,
  raInsertToolApproval,
  raListAgents,
  raListMemory,
  raListMessages,
  raListProviders,
  raListSessions,
  raListSwarms,
  raListThoughtCommands,
  raMetaGet,
  raMetaSet,
  raInsertInsightCalibrationSample,
  raListInsightCalibrationSamples,
  raEncyclopediaCount,
  raEncyclopediaList,
  raEncyclopediaSetEnabled,
  raEncyclopediaUpsert,
  raInsertNeuralAlphabetEvent,
  raInsertSentenceCandidateRow,
  raInsertThoughtSelectionEvent,
  raNewId,
  raResolveProviderForChat,
  raGetDefaultChatProvider,
  raInsertSwarmRun,
  raUpsertAgent,
  raUpsertProvider,
  raUpdateMessage,
  raUpsertSession,
  raUpsertSwarm,
  raUpsertThoughtCommand
} from './ra-db'
import { raTestProviderType, raCompleteChat, raStreamChat, type OpenAIStreamDebug } from './ra-llm-providers'
import { raListProviderModels } from './ra-provider-models'
import type { RaProviderRow, RaAgentRow } from './ra-db'

const KEY = (id: string) => `ra_provider_key_${id}`

/** OpenAI/Anthropic chat streams: AbortController + user-cancel flag (vs timeout). */
const activeChatStreamControllers = new Map<string, AbortController>()
const chatStreamCancelRequested = new Map<string, boolean>()

const CHAT_STREAM_LOG = process.env.CEREBRAL_STREAM_LOG !== '0'

function chatStreamLog(msg: string) {
  if (CHAT_STREAM_LOG) {
    // eslint-disable-next-line no-console
    console.log(`[chat stream] ${msg}`)
  }
}

function endpointHostOnly(url: string): string {
  try {
    return new URL(url.trim()).host
  } catch {
    return '(invalid url)'
  }
}

/** Maps HTTP / provider errors to accurate copy (avoid “offline” for 429, 401, etc.). */
function userFacingProviderChatError(agentName: string, provName: string, detail: string): string {
  const t = detail.trim()
  const tech = t ? `\n\n*Details:* ${t.slice(0, 2000)}` : ''
  if (!t) {
    return `**${agentName}** — request failed with no error text. Check **Model providers** (API key, model name, endpoint).`
  }
  if (/\b429\b|rate-limited|rate limit|too many requests|throttl/i.test(t)) {
    return (
      `**${agentName}** — **Rate limited (HTTP 429).** The free tier or upstream provider is temporarily throttling this model. Wait and retry, pick another model, or add your own OpenRouter key for higher limits (see openrouter.ai/settings).` +
      tech
    )
  }
  if (/\b401\b|\b403\b|invalid api key|incorrect api key|unauthorized|forbidden/i.test(t)) {
    return `**${agentName}** — **API key rejected or missing.** Open **Model providers** and set a valid key for **${provName}**.` + tech
  }
  if (/\b402\b|payment required|insufficient balance|credits|quota/i.test(t)) {
    return `**${agentName}** — **Billing or quota** from the API provider. Check your account on the provider’s site.` + tech
  }
  if (
    /fetch failed|ECONNREFUSED|ENOTFOUND|getaddrinfo|ETIMEDOUT|ECONNRESET|socket hang up|certificate|SSL/i.test(t)
  ) {
    return (
      `**${agentName}** — **Cannot reach ${provName}** (network, DNS, firewall, or TLS). Check the endpoint and your connection.` + tech
    )
  }
  return `**${agentName}** — request to **${provName}** failed:${tech}`
}

type SqliteDb = DatabaseConstructor.Database

function isLocalOnlyMode(db: SqliteDb): boolean {
  return raMetaGet(db, 'ra_local_only') === '1'
}

function isCloudType(t: string): boolean {
  return t === 'openrouter' || t === 'openai' || t === 'anthropic' || t === 'gemini'
}

type AgentChatRequest = {
  agentId: string
  userContent: string
  inputSource: string
  sessionId: string
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  workflowMode?: 'vibe' | 'imagine' | 'execute'
  skillAddendum?: string
}

function prepareResonantAgentChat(
  d: SqliteDb,
  a: AgentChatRequest
): { agent: RaAgentRow; p: RaProviderRow; key: string | undefined; messages: ChatMsg[]; temp: number; max: number } {
  const agent = raGetAgent(d, a.agentId)
  if (!agent) {
    throw new Error('Agent not found')
  }
  const resolved = raResolveProviderForChat(d, agent)
  if (!resolved) {
    throw new Error(
      'No provider is configured. Open Model providers, enable a default chat provider, or assign a working provider to this agent.'
    )
  }
  const p = resolved.provider
  const key = getSecretKey(KEY(p.id))
  if (isLocalOnlyMode(d) && isCloudType(p.type)) {
    throw new Error(
      'Local-only mode is on. Cloud provider usage is disabled. Switch this agent to a local provider or turn off local-only in settings.'
    )
  }
  if (isCloudType(p.type) && !key) {
    throw new Error(
      `Set an API key for ${p.name} in Cerebral OS → Model providers, or pick a local provider.`
    )
  }
  const mem = raListMemory(d, a.agentId).slice(0, 8) as Array<{
    title?: string
    body?: string
  }>
  const memBlock =
    mem.length > 0
      ? '\n\nRelevant saved memory:\n' +
        mem
          .map((m) => {
            const line = `${String(m.title ?? '')}: ${String(m.body ?? '')}`.replace(/\s+/g, ' ').trim()
            return line.length > 400 ? line.slice(0, 400) + '…' : line
          })
          .map((l) => `- ${l}`)
          .join('\n')
      : ''
  const wf =
    a.workflowMode === 'vibe'
      ? '\n\n[Composer workflow: Vibe — coding]\nShip real files. For each file, use a fenced code block. Prefer a language after the opening backticks (```html, ```css, ```js). The host can also auto-save unlabeled blocks that look like HTML/CSS/JS, but the reliable path is: put every file in a fence, then include <cerebral_actions> with write_file for each path. Never end with only a "How to run" (create a folder, paste files) when the user asked for a site or project — the app saves to the real workspace; your job is code + cerebral_actions, not a manual checklist.'
      : a.workflowMode === 'imagine'
        ? '\n\n[Composer workflow: Imagine — create & mix]\nBalance creative work with execution when asked. When you have image URLs, embed them in markdown as ![description](https://...) so the chat can show them inline. Good for docs, copy, outlines, and multi-step creative work.'
        : a.workflowMode === 'execute'
          ? "\n\n[Composer workflow: Execute — actions]\nYou are NOT a model with 'no internet' here: Cerebral OS can open public https URLs in the **in-app Live browser** (built-in webview) after the user approves a workspace action.\n\n**Opening a site:** When the user asks to go to, open, or visit a website (e.g. Google), include `{ \"type\": \"run_command\", \"command\": \"start https://www.google.com\" }` in your `<cerebral_actions>` on Windows (`start https://...`); on macOS use `open https://...`, Linux `xdg-open https://...`. After they click **Approve**, the app loads that URL in the Live browser tab. Do **not** refuse with lines like 'I cannot open web pages' or 'I do not have browsing' — you **can** propose this `run_command` and the host will open it in-app.\n\nPrioritize concrete steps, checklists, and one-line shell commands. Minimize empty preamble; focus on outcomes."
          : ''
  const add =
    a.skillAddendum && String(a.skillAddendum).trim() ? String(a.skillAddendum).slice(0, 12000) : ''
  const composerTools =
    a.workflowMode === 'vibe' || a.workflowMode === 'execute' || a.workflowMode === 'imagine'
      ? `

[CRITICAL — Cerebral OS workspace tools]
The app applies changes to the user's real workspace folder only after the user approves. Put JSON in a single block: \`<cerebral_actions> ... </cerebral_actions>\`, or a fence \`\`\`cerebral_actions ...\`\`\`, or the same JSON inside \`\`\`json ...\`\`\` (array of actions or { "actions": [...] }) — all three open the approval panel.

<cerebral_actions>
{ "actions": [
  { "type": "read_file", "path": "relative/path/in/workspace.txt" },
  { "type": "write_file", "path": "dirname/index.html", "content": "FULL FILE 1" },
  { "type": "write_file", "path": "dirname/style.css", "content": "FULL FILE 2" },
  { "type": "write_file", "path": "dirname/script.js", "content": "FULL FILE 3" }
] }
</cerebral_actions>

- **Actions:** \`read_file\`, \`write_file\`, \`edit_file\` (path, find, replace), \`delete_file\`, \`create_directory\`, \`open_file\`, \`run_command\` (one line; on Windows you may use \`cmd /c\` to chain). The user must approve the list in the app before any file or command runs.
- Every file you put in the markdown must appear again inside "content" in write_file. Escape quotes and newlines as JSON requires.
- "path" is relative to the workspace; use a subfolder (e.g. my-site/...) to group the project. Optional: add { "type": "run_command", "command": "npx serve ." } to preview (one line; use && to chain on Windows: cmd /c for cmd.exe).
- If the user only wanted an explanation, omit <cerebral_actions>. If they wanted a buildable app/site, omitting it is wrong — they should not be told to "create a folder and paste" instead. (The app may still auto-save from multiple labeled or sniffable code fences, but you must not substitute that for explicit actions in Vibe when delivering a project.)${
        a.workflowMode === 'execute'
          ? `

- **Execute mode — in-app web / URLs:** The host intercepts \`start https://...\` (Windows) / \`open\` / \`xdg-open\` in approved \`run_command\` actions and opens the **built-in webview** (Live browser tab). Use this for "go to google.com" instead of telling the user to use an external browser or claiming you cannot open links.`
          : ''
      }`
      : ''
  const systemPrefix =
    a.workflowMode === 'vibe' || a.workflowMode === 'execute'
      ? a.workflowMode === 'execute'
        ? 'You are running inside Cerebral OS Composer (**Execute**). The host can write files, run shell commands, and—after the user approves your plan—open public https URLs in the **in-app Live browser** via `run_command` (e.g. `start https://...` on Windows). Propose `<cerebral_actions>` with that command when the user asks to visit a site; do not claim you cannot open web pages.\n\n'
        : 'You are running inside Cerebral OS Composer. The host app can write files and run shell commands. Prefer execution via <cerebral_actions> over only giving manual "how to run" checklists for deliverable code.\n\n'
      : ''
  const system: ChatMsg = { role: 'system', content: systemPrefix + agent.system_prompt + memBlock + wf + add + composerTools }
  const hist: ChatMsg[] = (a.history ?? []).map((h) => ({
    role: h.role,
    content: h.content
  }))
  const user: ChatMsg = { role: 'user', content: a.userContent }
  const messages: ChatMsg[] = [system, ...hist.slice(-24), user]
  const temp = agent.temperature ?? p.temperature ?? 0.3
  const max = agent.max_output_tokens ?? p.max_output_tokens ?? 4096
  return { agent, p, key, messages, temp, max }
}

export function registerResonantIpc(db: SqliteDb | null, appLog: (m: string) => void): void {
  const ensureDb = (): SqliteDb => {
    if (!db) {
      throw new Error('Database is not available')
    }
    raEnsureSeed(db)
    return db
  }

  ipcMain.handle('ra:init', () => {
    const d = ensureDb()
    raEnsureSeed(d)
    return { ok: true }
  })

  ipcMain.handle('ra:settings', () => {
    const d = ensureDb()
    return {
      localOnly: raMetaGet(d, 'ra_local_only') === '1',
      showReasoningStream: raMetaGet(d, 'ra_show_reasoning_stream') === '1',
      autoListen: raMetaGet(d, 'ra_auto_listen') !== '0',
      sessionMode: (() => {
        const v = raMetaGet(d, 'ra_session_mode')
        if (v === 'manual' || v === 'hybrid' || v === 'thought') {
          return v
        }
        return null
      })(),
      demoMode: raMetaGet(d, 'ra_demo_mode') === '1',
      guideProviderId: (() => {
        const g = raMetaGet(d, 'ra_guide_provider_id')
        return g && g.length > 0 ? g : null
      })(),
      cortexUrl: (() => {
        const u = raMetaGet(d, 'cortex_wss_url')
        return u && u.length > 0 ? u : 'wss://localhost:6868'
      })(),
      emotivHeadsetId: (() => {
        const h = raMetaGet(d, 'emotiv_headset_id')
        return h && h.length > 0 ? h : ''
      })(),
      emotivStreams: (() => {
        const s = raMetaGet(d, 'emotiv_subscribe_streams')
        if (s && s.length > 0) {
          try {
            return JSON.parse(s) as string[]
          } catch {
            return ['eeg', 'met', 'pow', 'com', 'dev']
          }
        }
        return ['eeg', 'met', 'pow', 'com', 'dev']
      })()
    }
  })

  ipcMain.handle(
    'ra:settings:set',
    (
      _e,
      partial: {
        localOnly?: boolean
        showReasoningStream?: boolean
        autoListen?: boolean
        sessionMode?: 'manual' | 'hybrid' | 'thought' | null
        demoMode?: boolean
        guideProviderId?: string | null
        cortexUrl?: string
        emotivHeadsetId?: string
        emotivStreams?: string[]
      }
    ) => {
      const d = ensureDb()
      if (partial.localOnly !== undefined) {
        raMetaSet(d, 'ra_local_only', partial.localOnly ? '1' : '0')
      }
      if (partial.showReasoningStream !== undefined) {
        raMetaSet(d, 'ra_show_reasoning_stream', partial.showReasoningStream ? '1' : '0')
      }
      if (partial.autoListen !== undefined) {
        raMetaSet(d, 'ra_auto_listen', partial.autoListen ? '1' : '0')
      }
      if (partial.sessionMode !== undefined) {
        if (partial.sessionMode == null) {
          raMetaSet(d, 'ra_session_mode', '')
        } else {
          raMetaSet(d, 'ra_session_mode', partial.sessionMode)
        }
      }
      if (partial.demoMode !== undefined) {
        raMetaSet(d, 'ra_demo_mode', partial.demoMode ? '1' : '0')
      }
      if (partial.cortexUrl !== undefined) {
        raMetaSet(d, 'cortex_wss_url', partial.cortexUrl)
      }
      if (partial.emotivHeadsetId !== undefined) {
        raMetaSet(d, 'emotiv_headset_id', partial.emotivHeadsetId)
      }
      if (partial.emotivStreams !== undefined) {
        raMetaSet(d, 'emotiv_subscribe_streams', JSON.stringify(partial.emotivStreams))
      }
      if (partial.guideProviderId !== undefined) {
        if (partial.guideProviderId === null || partial.guideProviderId === '') {
          raMetaSet(d, 'ra_guide_provider_id', '')
        } else {
          raMetaSet(d, 'ra_guide_provider_id', partial.guideProviderId)
        }
      }
    }
  )

  ipcMain.handle(
    'ra:insight:calibration:insert',
    (
      _e,
      r: {
        id: string
        command_key: string
        calibration_run_id: string
        round_index: number
        phase: string
        sample_json: string
        created_at: string
      }
    ) => {
      raInsertInsightCalibrationSample(ensureDb(), r)
    }
  )

  ipcMain.handle('ra:insight:calibration:list', (_e, commandKey?: string) => {
    return raListInsightCalibrationSamples(ensureDb(), commandKey)
  })

  ipcMain.handle('ra:encyclopedia:list', () => {
    return raEncyclopediaList(ensureDb())
  })

  ipcMain.handle('ra:encyclopedia:count', () => {
    return raEncyclopediaCount(ensureDb())
  })

  ipcMain.handle('ra:encyclopedia:bulkSeed', (_e, rows: Array<Record<string, unknown>>) => {
    const d = ensureDb()
    for (const row of rows) {
      raEncyclopediaUpsert(
        d,
        row as {
          id: string
          phrase: string
          aliases_json: string
          mode: string
          category: string
          intent: string
          target: string | null
          action_json: string
          risk_level: string
          requires_confirmation: number
          thought_patterns_json: string | null
          clarification_question: string | null
          enabled: number
          created_at: string
          updated_at: string
        }
      )
    }
  })

  ipcMain.handle('ra:encyclopedia:setEnabled', (_e, a: { id: string; enabled: boolean }) => {
    raEncyclopediaSetEnabled(ensureDb(), a.id, a.enabled ? 1 : 0)
  })

  ipcMain.handle('ra:neural:alphabet:insert', (_e, r: { id: string; session_id: string | null; token_json: string; created_at: string }) => {
    raInsertNeuralAlphabetEvent(ensureDb(), r)
  })

  ipcMain.handle('ra:neural:sentence:insert', (_e, r: { id: string; session_id: string | null; batch_id: string; candidate_json: string; created_at: string }) => {
    raInsertSentenceCandidateRow(ensureDb(), r)
  })

  ipcMain.handle('ra:neural:selection:insert', (_e, r: { id: string; session_id: string | null; event_type: string; payload_json: string | null; created_at: string }) => {
    raInsertThoughtSelectionEvent(ensureDb(), r)
  })

  ipcMain.handle('ra:provider:list', () => {
    return raListProviders(ensureDb())
  })

  ipcMain.handle('ra:provider:get', (_e, id: string) => raGetProvider(ensureDb(), id) ?? null)

  ipcMain.handle(
    'ra:provider:upsert',
    (
      _e,
      row: {
        id: string
        name: string
        type: string
        endpoint_url: string
        model_name: string
        enabled: number
        local_only: number
        context_window: number | null
        temperature: number | null
        max_output_tokens: number | null
        privacy_mode: number | null
        default_chat: number
        default_planning: number
        default_coding: number
        default_report: number
        default_local_private: number
        local_gguf_path: string | null
        hf_import_url: string | null
        created_at: string
        updated_at: string
        apiKey?: string
      }
    ) => {
      const d = ensureDb()
      const { apiKey, ...rest } = row
      if (apiKey !== undefined) {
        if (apiKey === '') {
          clearSecretKey(KEY(row.id))
        } else {
          setSecretKey(KEY(row.id), apiKey)
        }
      }
      raUpsertProvider(d, rest as RaProviderRow)
    }
  )

  ipcMain.handle('ra:provider:delete', (_e, id: string) => {
    raDeleteProvider(ensureDb(), id)
    clearSecretKey(KEY(id))
  })

  ipcMain.handle('ra:provider:hasKey', (_e, id: string) => {
    return !!getSecretKey(KEY(id))
  })

  ipcMain.handle('ra:agent:list', () => {
    return raListAgents(ensureDb())
  })

  ipcMain.handle('ra:agent:get', (_e, id: string) => {
    return raGetAgent(ensureDb(), id) ?? null
  })

  ipcMain.handle('ra:agent:upsert', (_e, row: RaAgentRow) => {
    raUpsertAgent(ensureDb(), row)
  })

  ipcMain.handle('ra:agent:delete', (_e, id: string) => {
    raDeleteAgent(ensureDb(), id)
  })

  ipcMain.handle('ra:session:list', () => {
    return raListSessions(ensureDb())
  })

  ipcMain.handle('ra:session:get', (_e, id: string) => {
    return raGetSession(ensureDb(), id) ?? null
  })

  ipcMain.handle(
    'ra:session:upsert',
    (
      _e,
      r: {
        id: string
        title: string
        active_agent_id: string
        mode: string
        signal_lock_score: number | null
        neural_link_status: string
        started_at: string
        ended_at: string | null
        summary: string | null
        title_locked: number
      }
    ) => {
      raUpsertSession(ensureDb(), r)
    }
  )

  ipcMain.handle('ra:message:list', (_e, sessionId: string) => {
    return raListMessages(ensureDb(), sessionId)
  })

  ipcMain.handle(
    'ra:message:insert',
    (
      _e,
      r: {
        id: string
        session_id: string
        agent_id: string | null
        role: string
        input_source: string
        content: string
        tool_call_id: string | null
        created_at: string
        status?: string
        stream_id?: string | null
        error_text?: string | null
      }
    ) => {
      raInsertMessage(ensureDb(), r)
    }
  )

  ipcMain.handle(
    'ra:message:update',
    (
      _e,
      r: {
        id: string
        content?: string
        status?: string
        stream_id?: string | null
        error_text?: string | null
      }
    ) => {
      raUpdateMessage(ensureDb(), r)
    }
  )

  ipcMain.handle('ra:memory:list', (_e, agentId?: string) => {
    return raListMemory(ensureDb(), agentId)
  })

  ipcMain.handle(
    'ra:memory:insert',
    (
      _e,
      r: {
        id: string
        agent_id: string
        session_id: string | null
        memory_type: string
        title: string
        body: string
        meta_json: string | null
        created_at: string
      }
    ) => {
      raInsertMemory(ensureDb(), r)
    }
  )

  ipcMain.handle('ra:swarm:list', () => {
    return raListSwarms(ensureDb())
  })

  ipcMain.handle(
    'ra:swarm:upsert',
    (
      _e,
      r: {
        id: string
        name: string
        description: string
        agents_json: string
        orchestration_mode: string
        leader_agent_id: string | null
        max_turns: number
        approval_required: number
        created_at: string
      }
    ) => {
      raUpsertSwarm(ensureDb(), r)
    }
  )

  ipcMain.handle('ra:swarm:delete', (_e, id: string) => {
    raDeleteSwarm(ensureDb(), id)
  })

  ipcMain.handle('ra:swarm:run:insert', (_e, r: Parameters<typeof raInsertSwarmRun>[1]) => {
    raInsertSwarmRun(ensureDb(), r)
  })

  ipcMain.handle('ra:thought:list', (_e, sessionId: string) => {
    return raListThoughtCommands(ensureDb(), sessionId)
  })

  ipcMain.handle('ra:thought:upsert', (_e, r: Parameters<typeof raUpsertThoughtCommand>[1]) => {
    raUpsertThoughtCommand(ensureDb(), r)
  })

  ipcMain.handle('ra:toolApproval:insert', (_e, r: Parameters<typeof raInsertToolApproval>[1]) => {
    raInsertToolApproval(ensureDb(), r)
  })

  ipcMain.handle(
    'ra:provider:test',
    async (
      _e: IpcMainInvokeEvent,
      args: { id: string }
    ) => {
      const d = ensureDb()
      const p = raGetProvider(d, args.id)
      if (!p) {
        return { ok: false, error: 'Provider not found', endpoint: '' }
      }
      const key = getSecretKey(KEY(p.id))
      const local = isLocalOnlyMode(d)
      if (local && isCloudType(p.type)) {
        return {
          ok: false,
          error: 'Local-only mode is on. Disable it in Cerebral OS settings to use cloud providers.',
          endpoint: p.endpoint_url
        }
      }
      // Test may run even when the provider is disabled (verify key/endpoint, then enable + Save).
      if (p.type === 'local_gguf' && p.local_gguf_path) {
        appLog(`[RA] local GGUF path registered (orchestrator uses server endpoint, not file path).`)
      }
      const t = p.type
      if (t === 'lmstudio') {
        const r = await testOpenAICompatible(p.endpoint_url, p.model_name, undefined)
        if (!r.ok) {
          return { ok: false, error: 'Start LM Studio local server and load a model.', endpoint: p.endpoint_url }
        }
        return {
          ok: true,
          modelName: r.modelName ?? p.model_name,
          sample: r.sample,
          label: 'Test LM Studio Session',
          endpoint: p.endpoint_url
        }
      }
      const out = await raTestProviderType(t, p.endpoint_url, p.model_name, key, local)
      return { ...out, endpoint: p.endpoint_url }
    }
  )

  ipcMain.handle(
    'ra:provider:models',
    async (_e: IpcMainInvokeEvent, id: string) => {
      const d = ensureDb()
      const p = raGetProvider(d, id)
      if (!p) {
        return { ok: false, error: 'Provider not found', defaultModel: '', models: [] as { id: string; name: string }[] }
      }
      const key = getSecretKey(KEY(p.id))
      if (isLocalOnlyMode(d) && isCloudType(p.type)) {
        return {
          ok: true,
          defaultModel: p.model_name,
          models: [{ id: p.model_name, name: `${p.model_name} (local-only: cloud catalog disabled)` }],
          error: 'Local-only mode is on. Turn it off in settings to load cloud model lists.'
        }
      }
      const r = await raListProviderModels(p, key)
      return {
        ok: true,
        defaultModel: r.defaultId,
        models: r.models,
        error: r.error
      }
    }
  )

  ipcMain.handle(
    'ra:chat:complete',
    async (_e: IpcMainInvokeEvent, a: AgentChatRequest) => {
      const d = ensureDb()
      const { agent, p, key, messages, temp, max } = prepareResonantAgentChat(d, a)
      try {
        const text = await raCompleteChat(p.type, p.endpoint_url, agent.model_name, messages, key, {
          temperature: temp,
          max_tokens: max
        })
        cerebralInsertProviderLog(d, {
          id: newCerebralId(),
          provider_id: p.id,
          model_name: agent.model_name,
          agent_id: agent.id,
          success: 1,
          error_message: null,
          request_summary: 'chat'
        })
        return text
      } catch (err) {
        const detail = (err as Error).message
        const agentName = agent.name
        const provName = p.name
        try {
          cerebralInsertProviderLog(d, {
            id: newCerebralId(),
            provider_id: p.id,
            model_name: agent.model_name,
            agent_id: agent.id,
            success: 0,
            error_message: detail ? detail.slice(0, 2000) : 'error',
            request_summary: 'chat'
          })
        } catch {
          // ignore log failures
        }
        throw new Error(userFacingProviderChatError(agentName, provName, detail))
      }
    }
  )

  const cancelChatStream = (_e: IpcMainInvokeEvent, streamId: string) => {
    const ac = activeChatStreamControllers.get(streamId)
    if (ac) {
      chatStreamCancelRequested.set(streamId, true)
      ac.abort()
    }
    return { ok: true as const }
  }
  ipcMain.handle('ra:chat:stream:cancel', cancelChatStream)
  ipcMain.handle('ai:chatStreamCancel', cancelChatStream)

  ipcMain.handle(
    'ra:chat:stream',
    async (e: IpcMainInvokeEvent, a: AgentChatRequest & { streamId: string }) => {
      const d = ensureDb()
      const { streamId } = a
      const { agent, p, key, messages, temp, max } = prepareResonantAgentChat(d, a)
      const showReasoningStream = raMetaGet(d, 'ra_show_reasoning_stream') === '1'
      const ac = new AbortController()
      activeChatStreamControllers.set(streamId, ac)
      chatStreamCancelRequested.delete(streamId)
      const host = endpointHostOnly(p.endpoint_url)
      const t0 = Date.now()
      let firstTokenMs: number | null = null
      let chunkCount = 0
      if (p.type === 'gemini') {
        appLog(
          `[RA] chat stream: gemini non-streaming fallback (host=${host} model=${agent.model_name} streamId=${streamId})`
        )
      } else {
        appLog(`[RA] chat stream start (type=${p.type} host=${host} model=${agent.model_name} streamId=${streamId})`)
      }
      e.sender.send('ai:chatStreamStart', { streamId, providerType: p.type, model: agent.model_name })
      chatStreamLog(`started streamId=${streamId} type=${p.type} model=${agent.model_name}`)
      const workspaceRoot =
        cerebralGetWorkspaceRoot(d, 'default') || join(homedir(), 'CerebralOS', 'workspaces', 'default')
      const writer = new CodeFenceFileWriter(workspaceRoot, a.sessionId)
      const savedFiles: string[] = []
      const onDelta = (chunk: string) => {
        const c = typeof chunk === 'string' ? chunk : String(chunk ?? '')
        if (c) {
          if (firstTokenMs == null) {
            firstTokenMs = Date.now() - t0
          }
          chunkCount += 1
          chatStreamLog(`delta streamId=${streamId} len=${c.length}`)
          e.sender.send('ra:chat:stream:delta', { streamId, chunk: c })
          e.sender.send('ai:chatStreamChunk', { streamId, chunk: c })
        }
        for (const fp of writer.push(c)) {
          savedFiles.push(fp)
          e.sender.send('ra:chat:stream:file', { streamId, path: fp })
        }
      }
      let fullText = ''
      let usedNonStreamFallback = false
      const logStreamDebug = (dbg: OpenAIStreamDebug) => {
        appLog(
          `[RA] stream parse: contentChunks=${dbg.contentChunks} reasoningChunks=${dbg.reasoningChunks} ` +
            `toolChunks=${dbg.toolChunks} emptyChunks=${dbg.emptyChunks} finishReason=${dbg.finishReason ?? 'n/a'} ` +
            `usedNonStreamFallback=${dbg.usedNonStreamFallback} primaryLen=${dbg.primaryContentLength} reasoningBufLen=${dbg.reasoningBufferLength}`
        )
        if (
          dbg.primaryContentLength === 0 &&
          (dbg.reasoningBufferLength > 0 || dbg.toolChunks > 0) &&
          (dbg.emptyChunks > 0 || dbg.finishReason)
        ) {
          appLog(
            `[RA] stream: no visible chat text in primary content; reasoningLen=${dbg.reasoningBufferLength} ` +
              `toolChunks=${dbg.toolChunks} finishReason=${dbg.finishReason ?? 'n/a'}`
          )
        }
      }
      try {
        const streamResult = await raStreamChat(
          p.type,
          p.endpoint_url,
          agent.model_name,
          messages,
          key,
          {
            temperature: temp,
            max_tokens: max,
            showReasoningInStream: showReasoningStream,
            onStreamDebug:
              p.type !== 'anthropic' && p.type !== 'gemini' ? logStreamDebug : undefined
          },
          onDelta,
          ac.signal
        )
        fullText = streamResult.text
        usedNonStreamFallback = streamResult.usedNonStreamFallback
        const userCancelled = chatStreamCancelRequested.get(streamId) === true
        const doneStatus = userCancelled ? 'cancelled' : 'complete'
        const totalMs = Date.now() - t0
        const firstTok = firstTokenMs != null ? `${firstTokenMs}ms` : 'n/a'
        appLog(
          `[RA] chat stream done status=${doneStatus} host=${host} model=${agent.model_name} ` +
            `firstToken=${firstTok} total=${totalMs}ms chunks=${chunkCount} nonStreamFallback=${usedNonStreamFallback}`
        )
        cerebralInsertProviderLog(d, {
          id: newCerebralId(),
          provider_id: p.id,
          model_name: agent.model_name,
          agent_id: agent.id,
          success: 1,
          error_message: userCancelled ? 'cancelled' : null,
          request_summary: 'chat_stream'
        })
        e.sender.send('ra:chat:stream:done', {
          streamId,
          fullTextLength: fullText.length,
          chunkCount,
          cancelled: userCancelled
        })
        e.sender.send('ai:chatStreamDone', {
          streamId,
          cancelled: userCancelled,
          fullTextLength: fullText.length,
          chunkCount
        })
        chatStreamLog(`done streamId=${streamId} totalLen=${fullText.length} chunks=${chunkCount} cancelled=${userCancelled}`)
        return { fullText, savedFiles, cancelled: userCancelled, chunkCount, usedNonStreamFallback }
      } catch (err) {
        const detail = (err as Error).message
        e.sender.send('ra:chat:stream:error', { streamId, error: detail.slice(0, 2000) })
        e.sender.send('ai:chatStreamError', { streamId, error: detail.slice(0, 2000) })
        chatStreamLog(`error streamId=${streamId} lenMsg=${detail.length} chunksSoFar=${chunkCount}`)
        const totalMs = Date.now() - t0
        appLog(
          `[RA] chat stream error status=error host=${host} model=${agent.model_name} ` +
            `total=${totalMs}ms chunks=${chunkCount} (message len=${detail.length})`
        )
        const agentName = agent.name
        const provName = p.name
        try {
          cerebralInsertProviderLog(d, {
            id: newCerebralId(),
            provider_id: p.id,
            model_name: agent.model_name,
            agent_id: agent.id,
            success: 0,
            error_message: detail ? detail.slice(0, 2000) : 'error',
            request_summary: 'chat_stream'
          })
        } catch {
          // ignore log failures
        }
        e.sender.send('ra:chat:stream:done', { streamId, fullTextLength: 0, chunkCount, cancelled: false, error: true })
        e.sender.send('ai:chatStreamDone', { streamId, cancelled: false, fullTextLength: 0, error: true, chunkCount })
        chatStreamLog(`error-done streamId=${streamId} (rethrowing)`)
        throw new Error(userFacingProviderChatError(agentName, provName, detail))
      } finally {
        activeChatStreamControllers.delete(streamId)
        chatStreamCancelRequested.delete(streamId)
      }
    }
  )

  const GUIDE_SYSTEM = `You are the Cerebral OS Agent Guide. Help the user pick agents, explain modes (Manual, Hybrid, Thought), providers, and permissions. Be concise, practical, and never claim tools ran if they did not.`

  ipcMain.handle(
    'ra:guide:complete',
    async (
      _e: IpcMainInvokeEvent,
      a: { userContent: string; history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> }
    ) => {
      const d = ensureDb()
      const guidePid = raMetaGet(d, 'ra_guide_provider_id')
      let p: import('./ra-db').RaProviderRow | undefined
      if (guidePid) {
        p = raGetProvider(d, guidePid)
        if (p && !p.enabled) {
          p = undefined
        }
      }
      if (!p) {
        p = raGetDefaultChatProvider(d)
      }
      if (!p) {
        throw new Error('Agent Guide is offline until a provider is configured.')
      }
      if (p.type === 'gemini') {
        throw new Error('Agent Guide is offline until a provider is configured.')
      }
      const key = getSecretKey(KEY(p.id))
      if (isLocalOnlyMode(d) && isCloudType(p.type)) {
        throw new Error('Agent Guide is offline while local-only mode is enabled. Add a local provider or disable local-only mode.')
      }
      if (isCloudType(p.type) && !key) {
        throw new Error('Agent Guide is offline until a provider is configured with a valid API key.')
      }
      const system: ChatMsg = { role: 'system', content: GUIDE_SYSTEM }
      const hist: ChatMsg[] = (a.history ?? []).map((h) => ({ role: h.role, content: h.content }))
      const user: ChatMsg = { role: 'user', content: a.userContent }
      const messages: ChatMsg[] = [system, ...hist.slice(-20), user]
      const temp = p.temperature ?? 0.3
      const max = p.max_output_tokens ?? 2048
      try {
        return await raCompleteChat(p.type, p.endpoint_url, p.model_name, messages, key, { temperature: temp, max_tokens: max })
      } catch {
        throw new Error('Agent Guide is offline until a provider is configured.')
      }
    }
  )

  ipcMain.handle('ra:orchestrate:swarm:placeholder', (_e, swarmId: string) => {
    const d = ensureDb()
    const sw = raGetSwarm(d, swarmId)
    if (!sw) {
      return { ok: false, log: 'Swarm not found' }
    }
    const id = raNewId()
    raInsertSwarmRun(d, {
      id,
      swarm_id: swarmId,
      session_id: null,
      status: 'placeholder',
      log_json: JSON.stringify({
        message: 'Tool execution is not available in this build.',
        approval: 'Approval required for autonomous tool execution.',
        mode: String(sw.orchestration_mode)
      }),
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString()
    })
    return {
      ok: true,
      runId: id,
      note: 'Swarm run recorded as placeholder. No autonomous tool execution.',
      mode: String(sw.orchestration_mode)
    }
  })

  ipcMain.handle('ra:gguf:paths', () => {
    const raw = raMetaGet(ensureDb(), 'ra_gguf_paths')
    if (!raw) {
      return [] as string[]
    }
    try {
      return JSON.parse(raw) as string[]
    } catch {
      return []
    }
  })

  ipcMain.handle('ra:gguf:paths:set', (_e, paths: string[]) => {
    raMetaSet(ensureDb(), 'ra_gguf_paths', JSON.stringify(paths))
  })
}
