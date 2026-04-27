export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * Ollama / llama.cpp OpenAI-compatible chat expects POST to .../v1/chat/completions.
 * Users often store only the host:port; normalize so health checks and chat work.
 */
export function normalizeOpenAIChatCompletionsUrl(input: string): string {
  const s = input.trim()
  if (!s) {
    return s
  }
  let urlStr = s
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `http://${urlStr}`
  }
  let u: URL
  try {
    u = new URL(urlStr)
  } catch {
    return s
  }
  const path = u.pathname.replace(/\/$/, '') || ''
  if (path.includes('/v1/chat/completions')) {
    return u.toString()
  }
  if (path === '' || path === '/') {
    u.pathname = '/v1/chat/completions'
    return u.toString()
  }
  if (path === '/v1' || path.endsWith('/v1')) {
    u.pathname = `${path}/chat/completions`
    return u.toString()
  }
  return s
}

function logRrv(msg: string, fn?: (m: string) => void): void {
  const line = `${new Date().toISOString()} [LLM] ${msg}`
  if (fn) {
    fn(line)
  } else {
    try {
      // eslint-disable-next-line no-console
      console.log(line)
    } catch {
      // EPIPE when stdout is closed
    }
  }
}

export async function localChatCompletions(
  /** Full OpenAI-compatible URL, e.g. http://localhost:11434/v1/chat/completions */
  url: string,
  model: string,
  messages: ChatMsg[],
  onLog: ((m: string) => void) | undefined,
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  const finalUrl = normalizeOpenAIChatCompletionsUrl(url)
  logRrv(`POST ${finalUrl} model=${model}`, onLog)
  const res = await fetch(finalUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.25,
      max_tokens: options?.max_tokens ?? 4096,
      stream: false
    })
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`LLM HTTP ${res.status}: ${t.slice(0, 800)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content ?? ''
  logRrv(`response length=${text.length}`, onLog)
  return text
}

export async function testLLM(
  baseUrl: string,
  model: string,
  onLog?: (m: string) => void
): Promise<{ ok: boolean; error?: string; sample?: string; model?: string }> {
  try {
    const text = await localChatCompletions(
      baseUrl,
      model,
      [{ role: 'user', content: 'Reply with only: OK' }],
      onLog,
      { max_tokens: 8 }
    )
    return { ok: true, sample: text.slice(0, 200), model }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function listOllamaModels(ollamaHost: string): Promise<string[]> {
  const b = ollamaHost.replace(/\/$/, '')
  const root = b.includes('/v1') ? b.split('/v1')[0] : b.replace(/\/v1.*/, '')
  const url = `${root}/api/tags`
  const res = await fetch(url)
  if (!res.ok) {
    return []
  }
  const j = (await res.json()) as { models?: Array<{ name: string }> }
  return (j.models ?? []).map((m) => m.name)
}
