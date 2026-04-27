import { normalizeOpenAIChatCompletionsUrl } from './local-llm'
import type { RaProviderRow } from './ra-db'

const OPENROUTER_EXTRAS: Record<string, string> = {
  'HTTP-Referer': 'https://cerebral-os.local',
  'X-Title': 'Cerebral OS'
}

export type ProviderModelItem = { id: string; name: string }

/** If Anthropic list API is unavailable, offer common ids so the UI is still useful. */
const ANTHROPIC_FALLBACK: ProviderModelItem[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
]

function uniqueById(items: ProviderModelItem[]): ProviderModelItem[] {
  const seen = new Set<string>()
  const out: ProviderModelItem[] = []
  for (const x of items) {
    if (!x.id || seen.has(x.id)) {
      continue
    }
    seen.add(x.id)
    out.push(x)
  }
  return out
}

function sortModels(items: ProviderModelItem[], defaultId: string): ProviderModelItem[] {
  const u = uniqueById(items)
  u.sort((a, b) => {
    if (a.id === defaultId) {
      return -1
    }
    if (b.id === defaultId) {
      return 1
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
  return u
}

function withDefaultId(items: ProviderModelItem[], defaultId: string): ProviderModelItem[] {
  if (items.some((m) => m.id === defaultId)) {
    return items
  }
  return [{ id: defaultId, name: defaultId }, ...items]
}

function chatUrlToModelsUrl(chatCompletionsUrl: string): string {
  const c = normalizeOpenAIChatCompletionsUrl(chatCompletionsUrl)
  return c.replace(/\/v1\/chat\/completions\/?$/i, '/v1/models')
}

/**
 * OpenAI + LM Studio + many local servers: { data: [ { id, object?, owned_by? } ] }
 * Some variants use { models: [...] }.
 */
function parseOpenAIStyleModelsJson(json: unknown, max: number = 500): ProviderModelItem[] {
  if (!json || typeof json !== 'object') {
    return []
  }
  const o = json as Record<string, unknown>
  let arr: Array<{ id?: string; name?: string; object?: string }> = []
  if (Array.isArray(o.data)) {
    arr = o.data as Array<{ id?: string; name?: string; object?: string }>
  } else if (Array.isArray(o.models)) {
    arr = o.models as Array<{ id?: string; name?: string; object?: string }>
  } else {
    return []
  }
  const out: ProviderModelItem[] = []
  for (const m of arr) {
    const id = m.id
    if (!id || typeof id !== 'string') {
      continue
    }
    const display = typeof m.name === 'string' && m.name.trim() ? m.name.trim() : id
    out.push({ id, name: display })
    if (out.length >= max) {
      break
    }
  }
  return out
}

/** Drop obvious non–chat-completion models for OpenAI.com noise reduction. */
function filterOpenAIChatlike(items: ProviderModelItem[]): ProviderModelItem[] {
  return items.filter((m) => {
    const id = m.id.toLowerCase()
    if (/embedding|whisper|tts|moderation|dall-e|omni-moderation|babbage-002$|text-similarity|ada-002$/.test(id)) {
      return false
    }
    return true
  })
}

async function fetchOpenAICompatibleModelsList(
  modelsUrl: string,
  apiKey: string | undefined
): Promise<ProviderModelItem[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  const res = await fetch(modelsUrl, { method: 'GET', headers })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`)
  }
  const json = (await res.json()) as unknown
  return parseOpenAIStyleModelsJson(json, 500)
}

function anthropicModelsListUrl(endpointMessages: string): string {
  const t = endpointMessages.trim()
  if (/\/v1\/messages\/?$/i.test(t)) {
    return t.replace(/\/v1\/messages\/?$/i, '/v1/models')
  }
  return 'https://api.anthropic.com/v1/models'
}

async function fetchAnthropicModels(apiKey: string, endpoint: string): Promise<ProviderModelItem[]> {
  const url = anthropicModelsListUrl(endpoint)
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`)
  }
  const j = (await res.json()) as { data?: Array<{ id: string; display_name?: string; name?: string }> }
  return (j.data ?? []).map((m) => ({
    id: m.id,
    name: (m.display_name && m.display_name.trim()) || m.name || m.id
  }))
}

function geminiListUrl(base: string, apiKey: string): string {
  const b = base.replace(/\/$/, '')
  if (b.includes('generativelanguage.googleapis.com')) {
    if (b.includes('/v1beta')) {
      return `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    }
    if (b.includes('/v1')) {
      return `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`
    }
  }
  return `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
}

function geminiNameToId(name: string): string {
  if (name.startsWith('models/')) {
    return name.slice('models/'.length)
  }
  return name
}

async function fetchGeminiModels(apiKey: string, baseEndpoint: string): Promise<ProviderModelItem[]> {
  const url = geminiListUrl(baseEndpoint, apiKey)
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`)
  }
  const j = (await res.json()) as {
    models?: Array<{
      name: string
      displayName?: string
      supportedGenerationMethods?: string[]
    }>
  }
  const rows = (j.models ?? [])
    .filter((m) => {
      if (!m.name) {
        return false
      }
      const sm = m.supportedGenerationMethods
      if (!sm || !sm.length) {
        return true
      }
      return sm.includes('generateContent')
    })
    .map((m) => {
      const id = geminiNameToId(m.name)
      return { id, name: (m.displayName && m.displayName.trim()) || id }
    })
  return rows
}

async function ollamaNativeTags(origin: string): Promise<ProviderModelItem[]> {
  const r = await fetch(`${origin}/api/tags`, { method: 'GET' })
  if (!r.ok) {
    return []
  }
  const j = (await r.json()) as { models?: Array<{ name: string; model?: string }> }
  return (j.models ?? [])
    .map((m) => m.name || m.model)
    .filter((n): n is string => !!n)
    .map((id) => ({ id, name: id }))
}

/**
 * List models for UI dropdowns. `defaultId` is the provider’s configured `model_name` (shown first when possible).
 */
export async function raListProviderModels(
  p: RaProviderRow,
  apiKey: string | undefined
): Promise<{ defaultId: string; models: ProviderModelItem[]; error?: string }> {
  const defaultId = p.model_name?.trim() || 'default'

  const finish = (items: ProviderModelItem[], err?: string) => {
    const w = withDefaultId(items, defaultId)
    return { defaultId, models: sortModels(w, defaultId), error: err }
  }

  try {
    if (p.type === 'openrouter') {
      if (!apiKey) {
        return {
          defaultId,
          models: withDefaultId([], defaultId).map((m) => ({
            id: m.id,
            name: m.id
          })),
          error: 'Add an API key for this OpenRouter entry to load the model catalog.'
        }
      }
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, ...OPENROUTER_EXTRAS }
      })
      if (!res.ok) {
        const t = await res.text()
        return {
          defaultId,
          models: withDefaultId([], defaultId).map((x) => ({ id: x.id, name: x.id })),
          error: `OpenRouter: ${res.status} ${t.slice(0, 200)}`
        }
      }
      const data = (await res.json()) as { data?: Array<{ id: string; name?: string }> }
      const raw = (data.data ?? [])
        .map((m) => ({
          id: m.id,
          name: (m.name && m.name.trim()) || m.id
        }))
        .filter((m) => m.id)
      return finish(raw)
    }

    if (p.type === 'ollama') {
      const u = new URL(normalizeOpenAIChatCompletionsUrl(p.endpoint_url))
      const origin = u.origin
      let items = await ollamaNativeTags(origin)
      if (items.length === 0) {
        try {
          const openaiStyle = await fetchOpenAICompatibleModelsList(
            `${origin}/v1/models`,
            undefined
          )
          items = openaiStyle
        } catch {
          /* use empty */
        }
      }
      if (items.length === 0) {
        return {
          defaultId,
          models: withDefaultId([], defaultId).map((x) => ({ id: x.id, name: x.id })),
          error: 'No models from Ollama. Is the server running and are models pulled?'
        }
      }
      return finish(items)
    }

    if (p.type === 'openai') {
      if (!apiKey) {
        return {
          defaultId,
          models: withDefaultId([], defaultId).map((x) => ({ id: x.id, name: x.id })),
          error: 'Add an API key to list OpenAI models.'
        }
      }
      const modelsUrl = chatUrlToModelsUrl(p.endpoint_url)
      let items = await fetchOpenAICompatibleModelsList(modelsUrl, apiKey)
      items = filterOpenAIChatlike(items)
      if (items.length === 0) {
        return {
          defaultId,
          models: withDefaultId([], defaultId).map((x) => ({ id: x.id, name: x.id })),
          error: 'OpenAI returned no chat models, or the key lacks list permission.'
        }
      }
      return finish(items)
    }

    if (p.type === 'anthropic') {
      if (!apiKey) {
        return {
          defaultId,
          models: withDefaultId(ANTHROPIC_FALLBACK, defaultId),
          error: 'Add an API key to list Anthropic models (showing common defaults until then).'
        }
      }
      try {
        const items = await fetchAnthropicModels(apiKey, p.endpoint_url)
        if (items.length === 0) {
          return finish(ANTHROPIC_FALLBACK, 'No models in API response; using common defaults.')
        }
        return finish(items)
      } catch (e) {
        return finish(
          ANTHROPIC_FALLBACK,
          `Could not list models: ${(e as Error).message}. Using common defaults.`
        )
      }
    }

    if (p.type === 'gemini') {
      if (!apiKey) {
        return {
          defaultId,
          models: withDefaultId([], defaultId).map((x) => ({ id: x.id, name: x.id })),
          error: 'Add an API key to list Google Gemini models.'
        }
      }
      try {
        const items = await fetchGeminiModels(apiKey, p.endpoint_url)
        if (items.length === 0) {
          return {
            defaultId,
            models: withDefaultId([{ id: defaultId, name: defaultId }], defaultId),
            error: 'No generateContent models returned. Check the API key.'
          }
        }
        return finish(items)
      } catch (e) {
        return {
          defaultId,
          models: withDefaultId([{ id: defaultId, name: defaultId }], defaultId),
          error: (e as Error).message
        }
      }
    }

    if (p.type === 'lmstudio' || p.type === 'llama_cpp' || p.type === 'custom_openai' || p.type === 'local_gguf') {
      const modelsUrl = chatUrlToModelsUrl(p.endpoint_url)
      let items: ProviderModelItem[] = []
      let err: string | undefined
      try {
        items = await fetchOpenAICompatibleModelsList(modelsUrl, apiKey)
      } catch (e) {
        err = (e as Error).message
      }
      if (items.length === 0) {
        return {
          defaultId,
          models: withDefaultId([], defaultId),
          error:
            err ||
            (p.type === 'lmstudio'
              ? 'No models. Start LM Studio, load a model, and ensure the local server is on (see /v1/models).'
              : p.type === 'local_gguf'
                ? 'No models from the GGUF server. Ensure the llama.cpp server is running and exposes /v1/models.'
                : 'No models from this server. Check the URL and that /v1/models is available.')
        }
      }
      return finish(items)
    }
  } catch (e) {
    return {
      defaultId,
      models: withDefaultId([{ id: defaultId, name: defaultId }], defaultId),
      error: (e as Error).message
    }
  }

  return { defaultId, models: withDefaultId([{ id: defaultId, name: defaultId }], defaultId) }
}
