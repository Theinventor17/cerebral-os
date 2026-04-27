import type { ClaudeSkillCatalogEntry, ClaudeSkillsCatalog } from '@/types/claudeSkills'

const LS_KEY = 'cerebral.skillMarkdownCache.v1'
const MAX_CACHED = 32
const MAX_BODY_CHARS = 120_000

type CacheRow = { id: string; text: string; at: string }

function readStore(): Record<string, CacheRow> {
  if (typeof localStorage === 'undefined') {
    return {}
  }
  try {
    const j = localStorage.getItem(LS_KEY)
    if (!j) {
      return {}
    }
    return JSON.parse(j) as Record<string, CacheRow>
  } catch {
    return {}
  }
}

function writeStore(m: Record<string, CacheRow>): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  const keys = Object.keys(m)
  if (keys.length > MAX_CACHED) {
    const sorted = keys
      .map((k) => ({ k, t: m[k].at }))
      .sort((a, b) => a.t.localeCompare(b.t))
    for (let i = 0; i < keys.length - MAX_CACHED; i++) {
      delete m[sorted[i].k]
    }
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(m))
  } catch {
    // quota — drop half
    const half = Object.fromEntries(Object.entries(m).slice(-Math.floor(MAX_CACHED / 2)))
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(half))
    } catch {
      // ignore
    }
  }
}

export function getCachedSkillMarkdown(id: string): string | null {
  const m = readStore()
  return m[id]?.text ?? null
}

export function setCachedSkillMarkdown(id: string, text: string): void {
  const m = readStore()
  m[id] = { id, text: text.length > MAX_BODY_CHARS ? text.slice(0, MAX_BODY_CHARS) : text, at: new Date().toISOString() }
  writeStore(m)
}

/**
 * Fetches raw SKILL.md from the catalog (usually raw.githubusercontent). Cached by skill id.
 */
export async function fetchSkillMarkdown(e: ClaudeSkillCatalogEntry, signal?: AbortSignal): Promise<string> {
  const hit = getCachedSkillMarkdown(e.id)
  if (hit) {
    return hit
  }
  const u = e.rawUrl || ''
  if (!u.startsWith('http')) {
    return ''
  }
  const ac = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (!signal) {
    timeoutId = setTimeout(() => ac.abort(), 12_000)
  }
  try {
    const r = await fetch(u, { signal: signal ?? ac.signal, cache: 'force-cache' })
    if (!r.ok) {
      throw new Error(`HTTP ${r.status} for ${u}`)
    }
    const text = await r.text()
    setCachedSkillMarkdown(e.id, text)
    return text
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

export function findCatalogEntry(catalog: ClaudeSkillsCatalog, id: string): ClaudeSkillCatalogEntry | undefined {
  return catalog.skills.find((x) => x.id === id)
}
