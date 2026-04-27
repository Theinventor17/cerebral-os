import { allLineClosedFences } from '@/utils/markdownFences'
import type { WorkspaceAction } from './WorkspaceTypes'

const TAG_RE = /<cerebral_actions\b[^>]*>([\s\S]*?)<\/cerebral_actions>/i
const FENCE_RE = /```\s*cerebral_actions\s*\n?([\s\S]*?)```/i

function stripOuterFence(s: string): string {
  let t = s.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-z0-9_-]*\s*/i, '')
    t = t.replace(/```\s*$/i, '')
  }
  return t.trim()
}

function tryParseJsonActions(jsonStr: string): unknown {
  const cleaned = stripOuterFence(jsonStr)
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    return null
  }
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

function asString(v: unknown): string {
  return v == null ? '' : typeof v === 'string' ? v : String(v)
}

function validateOne(raw: Record<string, unknown>): WorkspaceAction | null {
  const type = asString(raw.type).trim()
  if (!type) {
    return null
  }
  const path = asString(raw.path).trim().replace(/\\/g, '/')
  switch (type) {
    case 'write_file':
      if (!path) {
        return null
      }
      return { type: 'write_file', path, content: asString(raw.content) }
    case 'edit_file': {
      const find = asString(raw.find)
      const replace = asString(raw.replace)
      if (!path || !find) {
        return null
      }
      const replaceAll = raw.replaceAll === true || asString(raw.mode) === 'all'
      return { type: 'edit_file', path, find, replace, replaceAll }
    }
    case 'delete_file':
      if (!path) {
        return null
      }
      return { type: 'delete_file', path }
    case 'create_directory':
    case 'mkdir':
      if (!path) {
        return null
      }
      return { type: 'create_directory', path }
    case 'run_command': {
      const command = asString(raw.command).trim()
      if (!command) {
        return null
      }
      return { type: 'run_command', command }
    }
    case 'open_file':
      if (!path) {
        return null
      }
      return { type: 'open_file', path }
    case 'read_file':
      if (!path) {
        return null
      }
      return { type: 'read_file', path }
    default:
      return null
  }
}

function collectActionsFromDoc(doc: unknown): WorkspaceAction[] {
  if (doc == null) {
    return []
  }
  if (Array.isArray(doc)) {
    const out: WorkspaceAction[] = []
    for (const x of doc) {
      if (x && typeof x === 'object') {
        const a = validateOne(x as Record<string, unknown>)
        if (a) {
          out.push(a)
        }
      }
    }
    return out
  }
  if (typeof doc === 'object' && doc !== null && 'actions' in doc) {
    const a = (doc as { actions?: unknown }).actions
    if (Array.isArray(a)) {
      return collectActionsFromDoc(a)
    }
  }
  return []
}

/** Remove all cerebral_actions regions from assistant text (for user-visible narrative). */
export function stripCerebralActionRegions(text: string): string {
  let t = text
  t = t.replace(TAG_RE, '')
  t = t.replace(FENCE_RE, '')
  return t.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Parse ```cerebral_actions or `<cerebral_actions>` and validate actions. Returns null if nothing valid.
 */
export function tryParseCerebralWorkspaceActions(assistantText: string): { actions: WorkspaceAction[]; narrative: string } | null {
  const s = assistantText
  const blocks: { raw: string; body: string }[] = []
  const m1 = s.match(TAG_RE)
  if (m1) {
    blocks.push({ raw: m1[0] ?? '', body: m1[1] ?? '' })
  }
  const m2 = s.match(FENCE_RE)
  if (m2) {
    const raw = m2[0] ?? ''
    if (!blocks.some((b) => b.raw === raw)) {
      blocks.push({ raw, body: m2[1] ?? '' })
    }
  }
  if (blocks.length === 0) {
    return null
  }
  const actions: WorkspaceAction[] = []
  for (const b of blocks) {
    const doc = tryParseJsonActions(b.body)
    if (doc) {
      actions.push(...collectActionsFromDoc(doc))
    }
  }
  if (actions.length === 0) {
    return null
  }
  let narrative = s
  for (const b of blocks) {
    narrative = narrative.replace(b.raw, '')
  }
  narrative = narrative.replace(/\n{3,}/g, '\n\n').trim()
  return { actions, narrative }
}

/**
 * Many models wrap the same action list in ` ```json ` instead of ` ```cerebral_actions `.
 * If the JSON is an `actions` bundle or a JSON array of `write_file` / etc., treat it like
 * `cerebral_actions` (approval UI, no silent skip).
 */
export function tryParseJsonFenceWorkspaceActions(assistantText: string): { actions: WorkspaceAction[]; narrative: string } | null {
  const s = assistantText
  const fences = allLineClosedFences(s)
  const all: WorkspaceAction[] = []
  const ranges: { start: number; end: number }[] = []
  for (const f of fences) {
    const lang0 = (f.langLine || '').trim().toLowerCase().split(/\s+/)[0] ?? ''
    if (lang0 !== 'json' && lang0 !== 'jsonc') {
      continue
    }
    const doc = tryParseJsonActions(f.content)
    if (doc == null) {
      continue
    }
    const chunk = collectActionsFromDoc(doc)
    if (chunk.length === 0) {
      continue
    }
    all.push(...chunk)
    ranges.push({ start: f.start, end: f.end })
  }
  if (all.length === 0) {
    return null
  }
  const sorted = [...ranges].sort((a, b) => b.start - a.start)
  let narrative = s
  for (const r of sorted) {
    narrative = narrative.slice(0, r.start) + narrative.slice(r.end)
  }
  narrative = narrative.replace(/\n{3,}/g, '\n\n').trim()
  return { actions: all, narrative }
}
