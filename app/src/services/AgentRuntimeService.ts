import type { WorkspaceAction } from '@/cerebral/workspace/WorkspaceTypes'
import type { AgentMessage, AgentMessageStatus, ComposerWorkflowMode, ResonantAgent, SessionMode } from '../types'
import type { ClaudeSkillsCatalog } from '../types/claudeSkills'
import claudeBundle from '../data/claudeSkillsCatalog.json'
import { buildWorkflowSkillAddendumSync } from '../cerebral/skill/workflowSkillImports'
import { newId, rowToMessage, rowToSession } from './mappers'
import { AgentMemoryService } from './AgentMemoryService'
import { runComposerToolBlock } from './ComposerToolRunner'
import { DEFAULT_SESSION_TITLE, deriveSessionTitleFromUserMessage, isDefaultSessionTitle } from './sessionTitle'

const skillsCatalog = claudeBundle as ClaudeSkillsCatalog

function ra() {
  return window.ra
}

type SessionUpsert = {
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

function rowToSessionUpsert(
  s: Record<string, unknown>,
  o: Partial<{
    title: string
    title_locked: number
    ended_at: string | null
    summary: string | null
    neural_link_status: string
    mode: string
    signal_lock_score: number | null
    active_agent_id: string
  }> = {}
): SessionUpsert {
  const locked = s.title_locked != null && Number(s.title_locked) === 1 ? 1 : 0
  return {
    id: String(s.id),
    title: o.title != null ? o.title : String(s.title),
    active_agent_id: o.active_agent_id != null ? o.active_agent_id : String(s.active_agent_id),
    mode: o.mode != null ? o.mode : String(s.mode),
    signal_lock_score:
      o.signal_lock_score !== undefined
        ? o.signal_lock_score
        : s.signal_lock_score == null
          ? null
          : Number(s.signal_lock_score),
    neural_link_status: o.neural_link_status != null ? o.neural_link_status : String(s.neural_link_status),
    started_at: String(s.started_at),
    ended_at: o.ended_at !== undefined ? o.ended_at : s.ended_at == null ? null : String(s.ended_at),
    summary: o.summary !== undefined ? o.summary : s.summary == null ? null : String(s.summary),
    title_locked: o.title_locked != null ? o.title_locked : locked
  }
}

export const AgentRuntimeService = {
  async ensureInit() {
    await ra().init()
  },

  async loadSettings() {
    return ra().settings.get() as Promise<{
      localOnly: boolean
      showReasoningStream: boolean
      autoListen: boolean
      sessionMode: 'manual' | 'hybrid' | 'thought' | null
      demoMode: boolean
      guideProviderId: string | null
      cortexUrl: string
      emotivHeadsetId: string
      emotivStreams: string[]
    }>
  },

  async setLocalOnly(v: boolean) {
    return ra().settings.set({ localOnly: v })
  },

  /** End every session that is still open (no ended_at). */
  async closeAllOpenSessions(): Promise<void> {
    const rows = await this.listSessions()
    for (const s of rows) {
      if (!s.endedAt) {
        await this.endSession(s.id, s.summary)
      }
    }
  },

  /** If multiple sessions have ended_at null, keep the newest and end the rest (DB repair / legacy). */
  async dedupeOpenSessionsKeepNewest(): Promise<void> {
    const all = await this.listSessions()
    const opens = all.filter((s) => !s.endedAt)
    if (opens.length <= 1) {
      return
    }
    const sorted = [...opens].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    for (const s of sorted.slice(1)) {
      await this.endSession(s.id, s.summary)
    }
  },

  /**
   * Switch to a conversation: closes other open sessions and, if this one was ended, reopens it.
   */
  async activateSession(sessionId: string): Promise<void> {
    const all = await this.listSessions()
    const target = all.find((s) => s.id === sessionId)
    if (!target) {
      throw new Error('Conversation not found')
    }
    for (const s of all) {
      if (!s.endedAt && s.id !== sessionId) {
        await this.endSession(s.id, s.summary)
      }
    }
    if (target.endedAt) {
      const raw = (await ra().session.get(sessionId)) as Record<string, unknown> | null
      if (!raw) {
        throw new Error('Conversation not found')
      }
      await ra().session.upsert(rowToSessionUpsert(raw, { ended_at: null }))
    }
  },

  async startSession(
    title: string,
    activeAgent: ResonantAgent,
    mode: SessionMode
  ): Promise<string> {
    await this.closeAllOpenSessions()
    const id = newId()
    const now = new Date().toISOString()
    await ra().session.upsert({
      id,
      title,
      active_agent_id: activeAgent.id,
      mode,
      signal_lock_score: null,
      neural_link_status: 'disconnected',
      started_at: now,
      ended_at: null,
      summary: null,
      title_locked: 0
    })
    return id
  },

  /**
   * Renames a conversation; locks the title so auto-titling will not override it.
   */
  async renameSession(sessionId: string, newTitle: string): Promise<void> {
    const s = (await ra().session.get(sessionId)) as Record<string, unknown> | null
    if (!s) {
      return
    }
    const t = newTitle.trim() || DEFAULT_SESSION_TITLE
    await ra().session.upsert(rowToSessionUpsert(s, { title: t, title_locked: 1 }))
  },

  /**
   * After the first user message, set title from the message text if still on the default
   * and the user has not manually locked the title.
   */
  async maybeAutoTitleFromFirstUserMessage(sessionId: string, userText: string): Promise<void> {
    const s = (await ra().session.get(sessionId)) as Record<string, unknown> | null
    if (!s) {
      return
    }
    if (s.title_locked != null && Number(s.title_locked) === 1) {
      return
    }
    const current = String(s.title)
    if (!isDefaultSessionTitle(current)) {
      return
    }
    const derived = deriveSessionTitleFromUserMessage(userText)
    if (!derived) {
      return
    }
    await ra().session.upsert(rowToSessionUpsert(s, { title: derived, title_locked: 0 }))
  },

  async endSession(sessionId: string, summary?: string) {
    const s = (await ra().session.get(sessionId)) as Record<string, unknown> | null
    if (!s) {
      return
    }
    await ra().session.upsert(
      rowToSessionUpsert(s, {
        ended_at: new Date().toISOString(),
        summary: summary ?? (s.summary == null ? null : String(s.summary))
      })
    )
  },

  async listMessages(sessionId: string): Promise<AgentMessage[]> {
    const rows = (await ra().message.list(sessionId)) as Array<Record<string, unknown>>
    return rows.map(rowToMessage)
  },

  async appendUserMessage(
    sessionId: string,
    activeAgent: ResonantAgent,
    text: string,
    input: AgentMessage['inputSource']
  ): Promise<string> {
    const id = newId()
    const now = new Date().toISOString()
    await ra().message.insert({
      id,
      session_id: sessionId,
      agent_id: activeAgent.id,
      role: 'user',
      input_source: input,
      content: text,
      tool_call_id: null,
      created_at: now
    })
    await this.maybeAutoTitleFromFirstUserMessage(sessionId, text)
    return id
  },

  async appendAssistantMessage(sessionId: string, agent: ResonantAgent, text: string) {
    const id = newId()
    const now = new Date().toISOString()
    await ra().message.insert({
      id,
      session_id: sessionId,
      agent_id: agent.id,
      role: 'assistant',
      input_source: 'system',
      content: text,
      tool_call_id: null,
      created_at: now
    })
    return id
  },

  async sendChat(
    sessionId: string,
    activeAgent: ResonantAgent,
    userText: string,
    input: AgentMessage['inputSource'],
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    opts?: { workflow?: ComposerWorkflowMode; skillAddendum?: string }
  ): Promise<string> {
    await this.appendUserMessage(sessionId, activeAgent, userText, input)
    const skillAddendum = opts?.skillAddendum ?? buildWorkflowSkillAddendumSync(opts?.workflow, skillsCatalog)
    let text = await ra().chat.complete({
      agentId: activeAgent.id,
      userContent: userText,
      inputSource: input,
      sessionId,
      workflowMode: opts?.workflow,
      skillAddendum: skillAddendum || undefined,
      history: history
        .filter((h) => h.role !== 'system')
        .map((h) => ({ role: h.role, content: h.content }))
    })
    if (!String(text ?? '').trim()) {
      text =
        '**No text was returned by the model.** Try another model, check **Providers** (API key), and **Logs** for errors.'
    }
    const { textForUser } = await runComposerToolBlock(text)
    await this.appendAssistantMessage(sessionId, activeAgent, textForUser)
    if (activeAgent.memoryEnabled) {
      await AgentMemoryService.add({
        agentId: activeAgent.id,
        sessionId,
        memoryType: 'conversation',
        title: 'Chat excerpt',
        body: userText.slice(0, 200) + (userText.length > 200 ? '…' : '')
      })
    }
    return text
  },

  /**
   * Stream assistant reply. Call `appendUserMessage` in the same turn before this so the thread and sidebar update immediately.
   * Inserts a `streaming` assistant row first, then appends tokens; final row is `complete` | `cancelled` | `failed`.
   */
  async sendChatStream(
    sessionId: string,
    activeAgent: ResonantAgent,
    userText: string,
    input: AgentMessage['inputSource'],
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    opts: {
      workflow?: ComposerWorkflowMode
      skillAddendum?: string
      /** Fired after the empty streaming assistant message is inserted (same tick as stream start). */
      onStreamingAssistant?: (m: AgentMessage) => void
    } | undefined,
    onDelta?: (chunk: string) => void,
    onFile?: (path: string) => void
  ): Promise<{
    fullText: string
    savedFiles: string[]
    workspacePaths: string[]
    cancelled?: boolean
    streamId: string
    finalStatus: AgentMessageStatus
    chunkCount: number
    /** True when the model returned text but no per-token events were observed. */
    bufferedResponse: boolean
    /** OpenRouter (and similar): one-shot `stream: false` retry after an empty visible stream. */
    usedNonStreamFallback: boolean
    /** Model proposed `cerebral_actions`; require UI approval before execution. */
    pendingWorkspaceActions?: WorkspaceAction[]
  }> {
    const skillAddendum = opts?.skillAddendum ?? buildWorkflowSkillAddendumSync(opts?.workflow, skillsCatalog)
    const streamId = newId()
    const now = new Date().toISOString()
    await ra().message.insert({
      id: streamId,
      session_id: sessionId,
      agent_id: activeAgent.id,
      role: 'assistant',
      input_source: 'system',
      content: '',
      tool_call_id: null,
      created_at: now,
      status: 'streaming',
      stream_id: streamId
    })
    const assistantMsg: AgentMessage = {
      id: streamId,
      sessionId,
      agentId: activeAgent.id,
      role: 'assistant',
      inputSource: 'system',
      content: '',
      createdAt: now,
      status: 'streaming',
      streamId
    }
    opts?.onStreamingAssistant?.(assistantMsg)
    let acc = ''
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    const flushToDb = async (status: 'streaming' | AgentMessageStatus) => {
      await ra().message.update({ id: streamId, content: acc, status, stream_id: streamId })
    }
    const scheduleFlush = () => {
      if (flushTimer) {
        clearTimeout(flushTimer)
      }
      flushTimer = setTimeout(() => {
        void flushToDb('streaming')
        flushTimer = null
      }, 500)
    }
    const offDelta = ra().chat.onChatStreamDelta((p) => {
      if (p.streamId === streamId) {
        acc += p.chunk
        onDelta?.(p.chunk)
        scheduleFlush()
      }
    })
    const offFile =
      onFile == null
        ? () => {}
        : ra().chat.onChatStreamFile((p) => {
            if (p.streamId === streamId) {
              onFile(p.path)
            }
          })
    let finalStatus: AgentMessageStatus = 'complete'
    try {
      const streamResult = (await ra().chat.completeStream({
        streamId,
        agentId: activeAgent.id,
        userContent: userText,
        inputSource: input,
        sessionId,
        workflowMode: opts?.workflow,
        skillAddendum: skillAddendum || undefined,
        history: history
          .filter((h) => h.role !== 'system')
          .map((h) => ({ role: h.role, content: h.content }))
      })) as {
        fullText: string
        savedFiles: string[]
        cancelled?: boolean
        chunkCount?: number
        usedNonStreamFallback?: boolean
      }
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      let { fullText, savedFiles } = streamResult
      const cancelled = streamResult.cancelled === true
      const chunkCount = streamResult.chunkCount ?? 0
      const usedNonStreamFallback = streamResult.usedNonStreamFallback === true
      const bufferedResponse =
        usedNonStreamFallback || (chunkCount === 0 && String(fullText ?? '').trim().length > 0)
      if (bufferedResponse) {
        // eslint-disable-next-line no-console
        console.log('[stream fallback] provider returned buffered response (no per-chunk events); still showing full text')
      }
      if (!String(fullText ?? '').trim() && !cancelled) {
        fullText =
          '**No text was returned by the model during streaming.**\n\n' +
          'Try another model, confirm your **OpenRouter** (or other) API key under **Providers**, and open **Logs** for the error. ' +
          'Some free or frontier models stream reasoning or tool metadata only—use a **chat / instruct** model, or enable **Show reasoning stream** under Model providers if the model emits reasoning without assistant text.'
      }
      acc = fullText
      const { textForUser, workspacePaths, pendingWorkspaceActions } = await runComposerToolBlock(fullText)
      finalStatus = cancelled ? 'cancelled' : 'complete'
      await ra().message.update({
        id: streamId,
        content: textForUser,
        status: finalStatus,
        stream_id: streamId,
        error_text: null
      })
      if (activeAgent.memoryEnabled) {
        await AgentMemoryService.add({
          agentId: activeAgent.id,
          sessionId,
          memoryType: 'conversation',
          title: 'Chat excerpt',
          body: userText.slice(0, 200) + (userText.length > 200 ? '…' : '')
        })
      }
      return {
        fullText,
        savedFiles,
        workspacePaths,
        cancelled,
        streamId,
        finalStatus,
        chunkCount,
        bufferedResponse,
        usedNonStreamFallback,
        pendingWorkspaceActions
      }
    } catch (e) {
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      const errMsg = (e as Error).message
      finalStatus = 'failed'
      await ra().message.update({
        id: streamId,
        content: acc,
        status: 'failed',
        stream_id: streamId,
        error_text: errMsg
      })
      throw e
    } finally {
      offDelta()
      offFile()
    }
  },

  async sendGuide(
    userText: string,
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ): Promise<string> {
    return ra().chat.guideComplete({
      userContent: userText,
      history: history.filter((h) => h.role !== 'system').map((h) => ({ role: h.role, content: h.content }))
    })
  },

  async listSessions() {
    const rows = (await ra().session.list()) as Array<Record<string, unknown>>
    return rows.map(rowToSession)
  }
}
