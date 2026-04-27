import type { ClaudeSkillCatalogEntry, ClaudeSkillsCatalog } from '@/types/claudeSkills'
import type { ComposerWorkflowMode } from '@/types'
import { getClaudeCatalog } from './claudeCatalog'
import { fetchSkillMarkdown, getCachedSkillMarkdown } from './skillMarkdownFetch'

/** Vibe / Imagine / Execute — Composer workflow modes that can each hold its own set of linked catalog skills. */
export const WORKFLOW_SKILL_MODES: { id: ComposerWorkflowMode; short: string; label: string }[] = [
  { id: 'vibe', short: 'V', label: 'Vibe' },
  { id: 'imagine', short: 'I', label: 'Imagine' },
  { id: 'execute', short: 'E', label: 'Execute' }
]

const STORAGE_KEY = 'cerebral.workflowSkillImports.v1'
/** Total cap aligned with `ra-handlers` (~12k slice); leave margin. */
const MAX_ADDENDUM = 10_500
const MAX_PER_SKILL_BODY = 4_200
const MAX_DESC_FALLBACK = 1_200

type Store = Record<ComposerWorkflowMode, string[]>

function parse(raw: string | null): Store {
  if (!raw) {
    return { vibe: [], imagine: [], execute: [] }
  }
  try {
    const j = JSON.parse(raw) as Partial<Store>
    return {
      vibe: Array.isArray(j.vibe) ? j.vibe : [],
      imagine: Array.isArray(j.imagine) ? j.imagine : [],
      execute: Array.isArray(j.execute) ? j.execute : []
    }
  } catch {
    return { vibe: [], imagine: [], execute: [] }
  }
}

export function loadWorkflowSkillImports(): Store {
  if (typeof localStorage === 'undefined') {
    return { vibe: [], imagine: [], execute: [] }
  }
  return parse(localStorage.getItem(STORAGE_KEY))
}

export function saveWorkflowSkillImports(s: Store): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function getImportedIdsForWorkflow(wf: ComposerWorkflowMode): string[] {
  return loadWorkflowSkillImports()[wf] ?? []
}

export function importSkillForWorkflow(wf: ComposerWorkflowMode, catalogSkillId: string): void {
  const s = loadWorkflowSkillImports()
  const set = new Set(s[wf])
  set.add(catalogSkillId)
  s[wf] = [...set]
  saveWorkflowSkillImports(s)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cerebral:workflow-skills-changed'))
  }
  const entry = getClaudeCatalog().skills.find((x) => x.id === catalogSkillId)
  if (entry) {
    void fetchSkillMarkdown(entry).catch(() => {
      // offline / CORS; buildWorkflowSkillAddendum will retry
    })
  }
}

export function removeSkillFromWorkflow(wf: ComposerWorkflowMode, catalogSkillId: string): void {
  const s = loadWorkflowSkillImports()
  s[wf] = (s[wf] ?? []).filter((id) => id !== catalogSkillId)
  saveWorkflowSkillImports(s)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cerebral:workflow-skills-changed'))
  }
}

export function isSkillImportedForWorkflow(wf: ComposerWorkflowMode, catalogSkillId: string): boolean {
  return getImportedIdsForWorkflow(wf).includes(catalogSkillId)
}

function findEntry(catalog: ClaudeSkillsCatalog, id: string): ClaudeSkillCatalogEntry | undefined {
  return catalog.skills.find((x) => x.id === id)
}

/**
 * Synchronous: uses cached SKILL.md only (localStorage) + catalog description. Must never `await` network
 * so chat streaming can start immediately. Background `fetchSkillMarkdown` on import warms the cache.
 */
export function buildWorkflowSkillAddendumSync(
  wf: ComposerWorkflowMode | undefined,
  catalog: ClaudeSkillsCatalog
): string {
  if (!wf) {
    return ''
  }
  const ids = getImportedIdsForWorkflow(wf)
  if (ids.length === 0) {
    return ''
  }
  const header =
    '\n\n[Imported Claude skills for this mode — follow these instructions when relevant. Do not claim tools, shell, or web actions ran without explicit user approval.]\n'
  const parts: string[] = [header]
  let total = header.length
  for (const id of ids) {
    const e = findEntry(catalog, id)
    if (!e) {
      const line = `\n- (missing catalog entry) \`${id}\`\n`
      if (total + line.length > MAX_ADDENDUM) {
        break
      }
      parts.push(line)
      total += line.length
      continue
    }
    const raw = (getCachedSkillMarkdown(e.id) ?? '').trim()
    const fallback = (e.description || '').replace(/\s+/g, ' ').trim()
    const body = raw || (fallback ? fallback.slice(0, MAX_DESC_FALLBACK) : '')
    if (!body) {
      const line = `\n### ${e.title} (\`${e.id}\`)\n_(No SKILL in cache yet — link the skill, wait a few seconds, or use the skills tab to prefetch.)_\n---\n`
      if (total + line.length > MAX_ADDENDUM) {
        break
      }
      parts.push(line)
      total += line.length
      continue
    }
    const core = body.length > MAX_PER_SKILL_BODY ? body.slice(0, MAX_PER_SKILL_BODY) + '\n… [truncated]' : body
    const block = `\n### ${e.title} (\`${e.id}\`)\n${core}\n---\n`
    if (total + block.length > MAX_ADDENDUM) {
      parts.push('\n… (further skills omitted for size — import fewer or rely on the marketplace to trim.)\n')
      break
    }
    parts.push(block)
    total += block.length
  }
  return parts.join('')
}

/**
 * @deprecated Prefer `buildWorkflowSkillAddendumSync` for chat — async fetch blocked streaming. Kept for compatibility.
 */
export async function buildWorkflowSkillAddendum(
  wf: ComposerWorkflowMode | undefined,
  catalog: ClaudeSkillsCatalog
): Promise<string> {
  return buildWorkflowSkillAddendumSync(wf, catalog)
}

export function importCountsByWorkflow(): Record<ComposerWorkflowMode, number> {
  const s = loadWorkflowSkillImports()
  return {
    vibe: s.vibe.length,
    imagine: s.imagine.length,
    execute: s.execute.length
  }
}
