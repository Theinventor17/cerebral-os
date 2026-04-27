import { localChatCompletions, normalizeOpenAIChatCompletionsUrl, type ChatMsg } from './local-llm'
import { OPENROUTER_CHAT_SAFE_PRESETS } from '../src/constants/openRouterChatSafePresets'

export { OPENROUTER_CHAT_SAFE_PRESETS }

/** Set CEREBRAL_STREAM_LOG=0 to silence stream parse logs (default: on). */
const STREAM_LOG = process.env.CEREBRAL_STREAM_LOG !== '0'

export type TestResult = { ok: boolean; error?: string; modelName?: string; sample?: string }

const OPENROUTER_HEADERS: Record<string, string> = {
  'HTTP-Referer': 'https://cerebral-os.local',
  'X-Title': 'CEREBRAL OS'
}

function normalizeMessageContentPart(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw
  }
  if (Array.isArray(raw)) {
    return raw
      .map((p) => {
        if (p && typeof p === 'object' && 'text' in p && typeof (p as { text: string }).text === 'string') {
          return (p as { text: string }).text
        }
        return ''
      })
      .join('')
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (typeof o.text === 'string') {
      return o.text
    }
    if (typeof o.value === 'string') {
      return o.value
    }
  }
  return ''
}

function extractTextFromOpenAIChoice(
  ch0: { message?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown }; text?: string; delta?: { content?: unknown } } | undefined
): string {
  if (!ch0) {
    return ''
  }
  if (ch0.message) {
    const m = ch0.message as Record<string, unknown>
    const t = normalizeMessageContentPart(m.content)
    if (t) {
      return t
    }
    for (const k of ['reasoning', 'reasoning_content'] as const) {
      const v = m[k]
      if (v != null) {
        const s = typeof v === 'string' ? v : JSON.stringify(v)
        if (s) {
          return s
        }
      }
    }
  }
  if (typeof ch0.text === 'string' && ch0.text.length) {
    return ch0.text
  }
  if (ch0.delta) {
    return normalizeMessageContentPart((ch0.delta as { content?: unknown }).content)
  }
  return ''
}

/** Non-SSE: whole body is one JSON with choices[0].message or choices[0].text. */
function extractOpenAIFromCompletionResponse(j: unknown): string {
  const o = j as { choices?: Array<Record<string, unknown>> }
  return extractTextFromOpenAIChoice(o.choices?.[0] as Parameters<typeof extractTextFromOpenAIChoice>[0])
}

export const TOOL_ONLY_STREAM_NOTE =
  'The model returned tool-call data but no visible chat text in the stream. Use a model that streams assistant **content** for normal replies, or check provider logs for `finish_reason`.'

export const REASONING_ONLY_USER_MESSAGE =
  'The model returned reasoning but no final answer. Try a standard chat model, or enable **Show reasoning stream** in Model providers (settings) to view reasoning output.'

export const NO_VISIBLE_MODEL_CONTENT_MESSAGE = 'Model returned no visible content.'

export type OpenAIStreamDebug = {
  contentChunks: number
  reasoningChunks: number
  toolChunks: number
  emptyChunks: number
  finishReason: string | null
  usedNonStreamFallback: boolean
  primaryContentLength: number
  reasoningBufferLength: number
}

const INTERESTING_FINISH = new Set(['tool_calls', 'length', 'content_filter', 'stop'])

function stringifyToolCallsSegment(raw: unknown): string {
  if (raw == null) {
    return ''
  }
  if (Array.isArray(raw)) {
    const parts: string[] = []
    for (const t of raw) {
      if (t && typeof t === 'object') {
        const o = t as Record<string, unknown>
        const id = o['id']
        const fn = o['function'] as { name?: string; arguments?: string } | undefined
        const name = fn?.name ?? o['name']
        const nameStr = typeof name === 'string' ? name : ''
        const args = typeof fn?.arguments === 'string' ? fn.arguments.slice(0, 200) : ''
        const line = [typeof id === 'string' ? id : '', nameStr, args].filter(Boolean).join(' ')
        if (line) {
          parts.push(line)
        }
      }
    }
    return parts.length ? `[tool_calls] ${parts.join(' | ')}` : ''
  }
  if (typeof raw === 'string') {
    return raw
  }
  try {
    return JSON.stringify(raw).slice(0, 800)
  } catch {
    return ''
  }
}

/** Per SSE JSON object: split chat text vs reasoning vs tool (Nemotron / OpenRouter / OpenAI). */
function parseOpenAIStreamEvent(j: unknown): {
  content: string
  reasoning: string
  messageReasoning: string
  toolSummary: string
  finishReason: string | null
  empty: boolean
} {
  const o = j as { choices?: Array<Record<string, unknown>> }
  const ch0 = o.choices?.[0] as Record<string, unknown> | undefined
  if (!ch0) {
    return { content: '', reasoning: '', messageReasoning: '', toolSummary: '', finishReason: null, empty: true }
  }
  const fr = ch0['finish_reason']
  const finishReason = typeof fr === 'string' && fr.length > 0 ? fr : null
  const d = ch0['delta'] as Record<string, unknown> | undefined
  let content = ''
  let reasoning = ''
  let messageReasoning = ''
  let toolSummary = ''
  if (d) {
    if (d['content'] != null) {
      content = normalizeMessageContentPart(d['content'])
    }
    if (typeof d['refusal'] === 'string' && d['refusal'].length) {
      content = content || d['refusal']
    }
    for (const k of ['reasoning', 'reasoning_content']) {
      if (d[k] != null) {
        const p =
          typeof d[k] === 'string' ? (d[k] as string) : typeof d[k] === 'object' ? JSON.stringify(d[k]) : String(d[k])
        if (p) {
          reasoning += p
        }
      }
    }
    for (const k of ['output_text', 'output', 'reasoningDetails']) {
      if (d[k] != null) {
        const p = typeof d[k] === 'string' ? d[k] as string : ''
        if (p) {
          content = content || p
        }
      }
    }
    if (typeof d['type'] === 'string' && typeof d['text'] === 'string' && d['text'].length) {
      content = content || (d['text'] as string)
    }
    if (d['tool_calls']) {
      const ts = stringifyToolCallsSegment(d['tool_calls'])
      if (ts) {
        toolSummary = toolSummary || ts
      }
    }
  }
  const msg = ch0['message'] as Record<string, unknown> | undefined
  if (msg) {
    if (msg['content'] != null) {
      const mc = normalizeMessageContentPart(msg['content'])
      if (mc) {
        content = content || mc
      }
    }
    for (const k of ['reasoning', 'reasoning_content']) {
      if (msg[k] != null) {
        const p = typeof msg[k] === 'string' ? (msg[k] as string) : JSON.stringify(msg[k])
        if (p) {
          messageReasoning += p
        }
      }
    }
    if (msg['tool_calls']) {
      const ts = stringifyToolCallsSegment(msg['tool_calls'])
      if (ts) {
        toolSummary = toolSummary || ts
      }
    }
  }
  if (typeof ch0['text'] === 'string' && (ch0['text'] as string).length) {
    content = content || (ch0['text'] as string)
  }
  const hasPayload = Boolean(
    content.length || reasoning.length || messageReasoning.length || (toolSummary && toolSummary.length)
  )
  const empty = !hasPayload && !finishReason
  return { content, reasoning, messageReasoning, toolSummary, finishReason, empty }
}

export async function testOpenAICompatible(
  endpointUrl: string,
  model: string,
  apiKey: string | undefined,
  extraHeaders?: Record<string, string>
): Promise<TestResult> {
  try {
    const url = normalizeOpenAIChatCompletionsUrl(endpointUrl)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    Object.assign(headers, extraHeaders)
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply only with OK.' }],
        max_tokens: 12,
        temperature: 0,
        stream: false
      })
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 500)}` }
    }
    const data = (await res.json()) as { model?: string; choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content ?? ''
    return { ok: true, modelName: data.model ?? model, sample: text.slice(0, 200) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function testAnthropic(apiKey: string, model: string, endpointOverride?: string): Promise<TestResult> {
  if (!apiKey) {
    return { ok: false, error: 'API key is required' }
  }
  const url = (endpointOverride ?? 'https://api.anthropic.com/v1/messages').trim()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Reply only with OK.' }]
      })
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 500)}` }
    }
    const data = (await res.json()) as { model?: string; content?: Array<{ text?: string }> }
    const text = data.content?.[0]?.text ?? ''
    return { ok: true, modelName: data.model ?? model, sample: text.slice(0, 200) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

function geminiModelPath(base: string, model: string, method: 'generateContent'): string {
  const root = base.replace(/\/$/, '')
  if (root.includes('generateContent')) {
    return root
  }
  return `${root}/models/${encodeURIComponent(model)}:${method}`
}

export async function testGemini(apiKey: string, model: string, baseUrl: string): Promise<TestResult> {
  if (!apiKey) {
    return { ok: false, error: 'API key is required' }
  }
  const path = geminiModelPath(baseUrl, model, 'generateContent')
  const url = `${path}?key=${encodeURIComponent(apiKey)}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply only with OK.' }] }] })
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 500)}` }
    }
    const data = (await res.json()) as { modelVersion?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return { ok: true, modelName: data.modelVersion ?? model, sample: text.slice(0, 200) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function completeOpenAIStyle(
  endpointUrl: string,
  model: string,
  messages: ChatMsg[],
  apiKey: string | undefined,
  opt?: { temperature?: number; max_tokens?: number },
  extraHeaders?: Record<string, string>
): Promise<string> {
  const url = normalizeOpenAIChatCompletionsUrl(endpointUrl)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  Object.assign(headers, extraHeaders ?? {})
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: opt?.temperature ?? 0.3,
      max_tokens: opt?.max_tokens ?? 4096,
      stream: false
    })
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenAI-style HTTP ${res.status}: ${t.slice(0, 800)}`)
  }
  const data = (await res.json()) as { choices?: Array<Record<string, unknown>> }
  return extractTextFromOpenAIChoice(data.choices?.[0] as Parameters<typeof extractTextFromOpenAIChoice>[0])
}

export async function completeAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  endpoint: string,
  opt?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  const sys = messages.filter((m) => m.role === 'system')
  const rest = messages.filter((m) => m.role !== 'system')
  const system = sys.map((m) => m.content).join('\n') || undefined
  const res = await fetch(endpoint.trim(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: opt?.max_tokens ?? 4096,
      temperature: opt?.temperature ?? 0.3,
      system,
      messages: rest.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    })
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Anthropic HTTP ${res.status}: ${t.slice(0, 800)}`)
  }
  const data = (await res.json()) as { content?: Array<{ text?: string }> }
  return data.content?.map((c) => c.text).join('') ?? ''
}

export async function completeGemini(
  apiKey: string,
  model: string,
  baseUrl: string,
  messages: ChatMsg[]
): Promise<string> {
  const path = geminiModelPath(baseUrl, model, 'generateContent')
  const url = `${path}?key=${encodeURIComponent(apiKey)}`
  const transcript = messages.map((m) => `[${m.role}] ${m.content}`).join('\n\n')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: transcript }] }] })
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 800)}`)
  }
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
}

export async function raTestProviderType(
  type: string,
  endpoint: string,
  model: string,
  apiKey: string | undefined,
  isCloudBlocked: boolean
): Promise<TestResult> {
  if (isCloudBlocked && type !== 'ollama' && type !== 'lmstudio' && type !== 'llama_cpp' && type !== 'local_gguf' && type !== 'custom_openai') {
    return { ok: false, error: 'Local-only mode is on; cloud provider tests are disabled.' }
  }
  if (isCloudBlocked && (type === 'custom_openai' && endpoint.includes('openai.com'))) {
    return { ok: false, error: 'Local-only mode is on; this endpoint looks like a cloud API.' }
  }

  switch (type) {
    case 'ollama':
    case 'lmstudio':
    case 'llama_cpp': {
      const r = await testOpenAICompatible(endpoint, model, undefined)
      if (!r.ok) {
        if (type === 'lmstudio') {
          return { ...r, error: r.error ? `${r.error} Start LM Studio local server and load a model.` : 'Start LM Studio local server and load a model.' }
        }
        return r
      }
      return { ok: true, modelName: r.modelName ?? model, sample: r.sample }
    }
    case 'openrouter':
      if (!apiKey) {
        return { ok: false, error: 'API key is required' }
      }
      return testOpenAICompatible(endpoint, model, apiKey, OPENROUTER_HEADERS)
    case 'openai':
      if (!apiKey) {
        return { ok: false, error: 'API key is required' }
      }
      return testOpenAICompatible(endpoint, model, apiKey)
    case 'custom_openai':
      return testOpenAICompatible(endpoint, model, apiKey)
    case 'anthropic':
      if (!apiKey) {
        return { ok: false, error: 'API key is required' }
      }
      return testAnthropic(apiKey, model, endpoint)
    case 'gemini':
      if (!apiKey) {
        return { ok: false, error: 'API key is required' }
      }
      return testGemini(apiKey, model, endpoint)
    case 'local_gguf': {
      if (!apiKey) {
        return testOpenAICompatible(endpoint, model, undefined)
      }
      return testOpenAICompatible(endpoint, model, apiKey)
    }
    default:
      return { ok: false, error: `Unknown provider type: ${type}` }
  }
}

/**
 * Anthropic Messages API with stream: true. Emits text deltas from SSE `data:` lines.
 */
export async function streamAnthropicMessages(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  endpoint: string,
  opt: { temperature?: number; max_tokens?: number } | undefined,
  onDelta: (chunk: string) => void,
  externalSignal?: AbortSignal
): Promise<string> {
  const sys = messages.filter((m) => m.role === 'system')
  const rest = messages.filter((m) => m.role !== 'system')
  const system = sys.map((m) => m.content).join('\n') || undefined
  const ac = new AbortController()
  const streamTimeoutMs = 180_000
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    ac.abort()
  }, streamTimeoutMs)
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId)
      return ''
    }
    externalSignal.addEventListener('abort', () => {
      clearTimeout(timeoutId)
      ac.abort()
    }, { once: true })
  }
  const url = endpoint.trim()
  let full = ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        accept: 'text/event-stream'
      },
      body: JSON.stringify({
        model,
        max_tokens: opt?.max_tokens ?? 4096,
        temperature: opt?.temperature ?? 0.3,
        system,
        stream: true,
        messages: rest.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      })
    })
    if (!res.ok || !res.body) {
      const t = await res.text()
      throw new Error(`Anthropic stream HTTP ${res.status}: ${t.slice(0, 800)}`)
    }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let carry = ''
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (externalSignal?.aborted) {
        return full
      }
      const { done, value } = await reader.read()
      if (value) {
        carry += dec.decode(value, { stream: !done })
      }
      let pos: number
      while ((pos = carry.indexOf('\n')) >= 0) {
        const line = carry.slice(0, pos)
        carry = carry.slice(pos + 1)
        const t = line.replace(/\r$/, '').trim()
        if (!t.startsWith('data:')) {
          continue
        }
        const data = t.slice(5).trim()
        if (data === '[DONE]') {
          return full
        }
        try {
          const j = JSON.parse(data) as {
            type?: string
            delta?: { type?: string; text?: string }
          }
          if (j.type === 'message_stop') {
            return full
          }
          if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta' && typeof j.delta.text === 'string') {
            const ch = j.delta.text
            full += ch
            onDelta(ch)
          }
        } catch {
          // ignore
        }
      }
      if (done) {
        break
      }
    }
    return full
  } catch (e) {
    if ((e as Error).name === 'AbortError' && !timedOut && externalSignal?.aborted) {
      return full
    }
    if ((e as Error).name === 'AbortError' && timedOut) {
      throw new Error(`Anthropic stream timed out after ${streamTimeoutMs / 1000}s.`)
    }
    if ((e as Error).name === 'AbortError') {
      return full
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

function runOpenAIStreamDebug(
  onStreamDebug: ((d: OpenAIStreamDebug) => void) | undefined,
  d: OpenAIStreamDebug
): void {
  onStreamDebug?.(d)
  if (STREAM_LOG) {
    console.log('[stream parser] summary', d)
  }
}

/**
 * OpenAI-compatible chat completions with stream: true. Parses SSE `data:` lines.
 * Handles Nemotron / OpenRouter: reasoning-only streams, tool_call deltas, and finish_reason.
 * When `opt.openrouterNonStreamRetry` and stream has no answer text, calls `stream: false` once.
 */
export type OpenAIStreamResult = { text: string; usedNonStreamFallback: boolean }

export async function streamOpenAIStyle(
  endpointUrl: string,
  model: string,
  messages: ChatMsg[],
  apiKey: string | undefined,
  opt:
    | {
        temperature?: number
        max_tokens?: number
        showReasoningInStream?: boolean
        onStreamDebug?: (d: OpenAIStreamDebug) => void
        openrouterNonStreamRetry?: boolean
      }
    | undefined,
  onDelta: (chunk: string) => void,
  extraHeaders?: Record<string, string>,
  externalSignal?: AbortSignal
): Promise<OpenAIStreamResult> {
  const url = normalizeOpenAIChatCompletionsUrl(endpointUrl)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  Object.assign(headers, extraHeaders ?? {})
  const ac = new AbortController()
  const streamTimeoutMs = 180_000
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    ac.abort()
  }, streamTimeoutMs)
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId)
      return { text: '', usedNonStreamFallback: false }
    }
    externalSignal.addEventListener('abort', () => {
      clearTimeout(timeoutId)
      ac.abort()
    }, { once: true })
  }
  const showReasoning = opt?.showReasoningInStream === true
  const openrouterNonStreamRetry = opt?.openrouterNonStreamRetry === true
  let contentChunks = 0
  let reasoningChunks = 0
  let toolChunks = 0
  let emptyChunks = 0
  let lastFinishReason: string | null = null
  let usedNonStreamFallback = false
  let primaryContent = ''
  let reasoningAll = ''
  let lastLoggedFinish: string | null = null
  const temperature = opt?.temperature ?? 0.3
  const maxTokens = opt?.max_tokens ?? 4096
  const emitStreamDebug = (over?: Partial<OpenAIStreamDebug>) => {
    runOpenAIStreamDebug(opt?.onStreamDebug, {
      contentChunks,
      reasoningChunks,
      toolChunks,
      emptyChunks,
      finishReason: lastFinishReason,
      usedNonStreamFallback: over?.usedNonStreamFallback ?? usedNonStreamFallback,
      primaryContentLength: primaryContent.length,
      reasoningBufferLength: reasoningAll.length
    })
  }

  const processJsonPayload = (payload: string): 'done' | 'continue' => {
    if (payload === '[DONE]') {
      if (STREAM_LOG) {
        console.log('[stream parser] [DONE]')
      }
      return 'done'
    }
    try {
      const j = JSON.parse(payload) as unknown
      if (STREAM_LOG) {
        console.log('[stream parser] data line received', payload.slice(0, 80))
      }
      const p = parseOpenAIStreamEvent(j)
      if (p.finishReason) {
        lastFinishReason = p.finishReason
        if (INTERESTING_FINISH.has(p.finishReason) && p.finishReason !== lastLoggedFinish) {
          if (STREAM_LOG) {
            console.log('[stream parser] finish_reason', p.finishReason)
          }
          lastLoggedFinish = p.finishReason
        }
      }
      if (p.empty && !p.finishReason) {
        emptyChunks += 1
      }
      if (p.content) {
        contentChunks += 1
        primaryContent += p.content
        onDelta(p.content)
        if (STREAM_LOG) {
          console.log('[stream parser] content chunk', p.content.length)
        }
      }
      const rPart = p.reasoning + p.messageReasoning
      if (rPart) {
        reasoningChunks += 1
        reasoningAll += rPart
        if (showReasoning) {
          onDelta(rPart)
        }
        if (STREAM_LOG) {
          console.log('[stream parser] reasoning chunk', rPart.length)
        }
      }
      if (p.toolSummary) {
        toolChunks += 1
        if (STREAM_LOG) {
          console.log('[stream parser] tool chunk', p.toolSummary.slice(0, 60))
        }
      }
    } catch {
      // ignore malformed JSON line
    }
    return 'continue'
  }

  const processDataLine = (line: string): 'done' | 'continue' => {
    const trimmed = line.replace(/\r$/, '').trim()
    if (!trimmed) {
      return 'continue'
    }
    const dm = trimmed.match(/^data:\s*(.*)$/i)
    if (!dm) {
      return 'continue'
    }
    return processJsonPayload((dm[1] ?? '').trim())
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: ac.signal,
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature,
        max_tokens: maxTokens,
        stream: true
      })
    })
    if (!res.ok || !res.body) {
      const errBody = await res.text()
      throw new Error(`OpenAI-style stream HTTP ${res.status}: ${errBody.slice(0, 800)}`)
    }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let carry = ''
    let sawDone = false
    // eslint-disable-next-line no-constant-condition
    while (!sawDone) {
      if (externalSignal?.aborted) {
        emitStreamDebug()
        return { text: buildAbortReturnString(primaryContent, reasoningAll, showReasoning), usedNonStreamFallback: false }
      }
      const { done, value } = await reader.read()
      if (value) {
        carry += dec.decode(value, { stream: !done })
      }
      let pos: number
      while ((pos = carry.indexOf('\n')) >= 0) {
        const raw = carry.slice(0, pos)
        carry = carry.slice(pos + 1)
        if (processDataLine(raw.replace(/\r$/, '')) === 'done') {
          sawDone = true
          break
        }
      }
      if (sawDone) {
        break
      }
      if (done) {
        break
      }
    }
    if (carry.trim().length) {
      for (const part of carry.split('\n')) {
        const t = part.replace(/\r$/, '')
        if (processDataLine(t) === 'done') {
          break
        }
      }
    }
    if (!primaryContent && carry.trim().length) {
      try {
        const j = JSON.parse(carry.trim()) as unknown
        const t = extractOpenAIFromCompletionResponse(j)
        if (t) {
          if (STREAM_LOG) {
            console.log('[stream fallback] provider returned buffered (non-SSE) response, len=', t.length)
          }
          primaryContent = t
          onDelta(t)
        }
      } catch {
        // not JSON
      }
    }

    if (toolChunks > 0 && !primaryContent.trim() && !reasoningAll.trim() && STREAM_LOG) {
      console.log('[stream parser] only tool / finish; no user-visible text in deltas; finishReason=', lastFinishReason)
    }
    if (lastFinishReason && INTERESTING_FINISH.has(lastFinishReason) && STREAM_LOG) {
      console.log('[stream parser] final finish_reason', lastFinishReason)
    }

    if (!primaryContent.trim() && reasoningAll.trim() && !showReasoning) {
      onDelta(`\n\n${REASONING_ONLY_USER_MESSAGE}`)
    }

    if (
      openrouterNonStreamRetry &&
      !externalSignal?.aborted &&
      !usedNonStreamFallback &&
      !primaryContent.trim() &&
      !reasoningAll.trim()
    ) {
      if (STREAM_LOG) {
        console.log('[stream parser] attempting non-stream retry (openrouter)')
      }
      try {
        const t2 = await completeOpenAIStyle(
          endpointUrl,
          model,
          messages,
          apiKey,
          { temperature, max_tokens: maxTokens },
          extraHeaders
        )
        if (t2 && String(t2).trim()) {
          usedNonStreamFallback = true
          onDelta(
            '\n\n' +
              t2 +
              '\n\n*Provider returned buffered response* (non-streaming fallback — stream had no visible chat text).'
          )
          emitStreamDebug()
          return { text: t2, usedNonStreamFallback: true }
        }
      } catch (e) {
        if (STREAM_LOG) {
          console.log('[stream parser] non-stream retry failed', (e as Error).message)
        }
      }
    }

    if (toolChunks > 0 && !primaryContent.trim() && !reasoningAll.trim() && !usedNonStreamFallback) {
      onDelta(`\n\n${TOOL_ONLY_STREAM_NOTE}`)
    }

    let out: string
    if (primaryContent.trim()) {
      out = primaryContent
    } else if (reasoningAll.trim() && !showReasoning) {
      out = REASONING_ONLY_USER_MESSAGE
    } else if (reasoningAll.trim() && showReasoning) {
      out = (primaryContent + reasoningAll).trim() || reasoningAll
    } else {
      out = primaryContent
    }
    if (!out.trim() && !usedNonStreamFallback) {
      out = NO_VISIBLE_MODEL_CONTENT_MESSAGE
    }
    emitStreamDebug()
    return { text: out, usedNonStreamFallback }
  } catch (e) {
    emitStreamDebug()
    if ((e as Error).name === 'AbortError' && !timedOut && externalSignal?.aborted) {
      return { text: buildAbortReturnString(primaryContent, reasoningAll, showReasoning), usedNonStreamFallback: false }
    }
    if ((e as Error).name === 'AbortError' && timedOut) {
      throw new Error(`OpenAI-style stream timed out after ${streamTimeoutMs / 1000}s.`)
    }
    if ((e as Error).name === 'AbortError') {
      return { text: buildAbortReturnString(primaryContent, reasoningAll, showReasoning), usedNonStreamFallback: false }
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildAbortReturnString(
  primaryContent: string,
  reasoningAll: string,
  showReasoning: boolean
): string {
  if (primaryContent.trim()) {
    return primaryContent
  }
  if (reasoningAll.trim() && showReasoning) {
    return (primaryContent + reasoningAll).trim() || reasoningAll
  }
  if (reasoningAll.trim() && !showReasoning) {
    return REASONING_ONLY_USER_MESSAGE
  }
  return primaryContent
}

export type RaStreamChatOptions = {
  temperature?: number
  max_tokens?: number
  showReasoningInStream?: boolean
  onStreamDebug?: (d: OpenAIStreamDebug) => void
}

export type RaStreamChatResult = OpenAIStreamResult

/** Stream when the provider uses OpenAI-compatible SSE; otherwise buffer and emit one chunk. */
export async function raStreamChat(
  type: string,
  endpoint: string,
  model: string,
  messages: ChatMsg[],
  apiKey: string | undefined,
  opt: RaStreamChatOptions | undefined,
  onDelta: (chunk: string) => void,
  externalSignal?: AbortSignal
): Promise<RaStreamChatResult> {
  const streamOpt = {
    ...opt,
    openrouterNonStreamRetry: type === 'openrouter'
  }
  switch (type) {
    case 'ollama':
    case 'lmstudio':
    case 'llama_cpp':
      return streamOpenAIStyle(endpoint, model, messages, apiKey, streamOpt, onDelta, undefined, externalSignal)
    case 'openrouter':
      if (!apiKey) {
        throw new Error('OpenRouter API key is required')
      }
      return streamOpenAIStyle(endpoint, model, messages, apiKey, streamOpt, onDelta, OPENROUTER_HEADERS, externalSignal)
    case 'openai':
      if (!apiKey) {
        throw new Error('OpenAI API key is required')
      }
      return streamOpenAIStyle(endpoint, model, messages, apiKey, streamOpt, onDelta, undefined, externalSignal)
    case 'custom_openai':
      return streamOpenAIStyle(endpoint, model, messages, apiKey, streamOpt, onDelta, undefined, externalSignal)
    case 'local_gguf':
      return streamOpenAIStyle(endpoint, model, messages, apiKey, streamOpt, onDelta, undefined, externalSignal)
    case 'anthropic': {
      if (!apiKey) {
        throw new Error('Anthropic API key is required')
      }
      const at = await streamAnthropicMessages(apiKey, model, messages, endpoint, opt, onDelta, externalSignal)
      return { text: at, usedNonStreamFallback: false }
    }
    case 'gemini': {
      const t = await raCompleteChat(type, endpoint, model, messages, apiKey, opt)
      onDelta(t)
      return { text: t, usedNonStreamFallback: false }
    }
    default:
      throw new Error(`Unsupported provider for streaming chat: ${type}`)
  }
}

export async function raCompleteChat(
  type: string,
  endpoint: string,
  model: string,
  messages: ChatMsg[],
  apiKey: string | undefined,
  opt?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  switch (type) {
    case 'ollama':
    case 'lmstudio':
    case 'llama_cpp':
      return localChatCompletions(endpoint, model, messages, undefined, { temperature: opt?.temperature, max_tokens: opt?.max_tokens })
    case 'openrouter':
      if (!apiKey) {
        throw new Error('OpenRouter API key is required')
      }
      return completeOpenAIStyle(endpoint, model, messages, apiKey, opt, OPENROUTER_HEADERS)
    case 'openai':
      if (!apiKey) {
        throw new Error('OpenAI API key is required')
      }
      return completeOpenAIStyle(endpoint, model, messages, apiKey, opt)
    case 'custom_openai':
      return completeOpenAIStyle(endpoint, model, messages, apiKey, opt)
    case 'anthropic':
      if (!apiKey) {
        throw new Error('Anthropic API key is required')
      }
      return completeAnthropic(apiKey, model, messages, endpoint, opt)
    case 'gemini':
      if (!apiKey) {
        throw new Error('Gemini API key is required')
      }
      return completeGemini(apiKey, model, endpoint, messages)
    case 'local_gguf':
      return localChatCompletions(endpoint, model, messages, undefined, { temperature: opt?.temperature, max_tokens: opt?.max_tokens })
    default:
      throw new Error(`Unsupported provider for chat: ${type}`)
  }
}
