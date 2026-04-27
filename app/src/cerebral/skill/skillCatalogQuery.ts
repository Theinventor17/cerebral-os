import type { ClaudeSkillCatalogEntry } from '@/types/claudeSkills'

export function humanizeCategory(cat: string): string {
  return cat
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' · ')
}

export function categoriesWithCount(skills: ClaudeSkillCatalogEntry[]): [string, number][] {
  const m = new Map<string, number>()
  for (const s of skills) {
    m.set(s.category, (m.get(s.category) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

function skillTextBlob(s: ClaudeSkillCatalogEntry): string {
  return [s.title, s.name, s.description, s.slug, s.id, s.relativePath, ...(s.tags || []), s.category, humanizeCategory(s.category)]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

/**
 * Text search: whitespace-separated terms must all match (AND) anywhere in the skill text.
 * Empty category and empty q = no filter on that axis.
 */
export function filterCatalogSkills(
  skills: ClaudeSkillCatalogEntry[],
  options: { q: string; category: string }
): ClaudeSkillCatalogEntry[] {
  const cat = options.category
  const terms = options.q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0)

  return skills.filter((s) => {
    if (cat && s.category !== cat) {
      return false
    }
    if (terms.length === 0) {
      return true
    }
    const blob = skillTextBlob(s)
    return terms.every((t) => blob.includes(t))
  })
}

export type SortMode = 'title' | 'category'

export function sortCatalogSkills(skills: ClaudeSkillCatalogEntry[], sort: SortMode): ClaudeSkillCatalogEntry[] {
  const copy = [...skills]
  if (sort === 'title') {
    copy.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name, undefined, { sensitivity: 'base' }))
  } else {
    copy.sort(
      (a, b) =>
        a.category.localeCompare(b.category) || (a.title || a.name).localeCompare(b.title || b.name, undefined, { sensitivity: 'base' })
    )
  }
  return copy
}

/**
 * Shorthand buttons for "what are you working on" — set search (not category) so they compose with category.
 */
export const SKILL_KEYWORD_PRESETS: { label: string; q: string; title?: string }[] = [
  { label: 'API', q: 'api', title: 'API / integration' },
  { label: 'Test', q: 'test', title: 'Testing & quality' },
  { label: 'Docs', q: 'doc', title: 'Documentation' },
  { label: 'Security', q: 'security', title: 'Security' },
  { label: 'Board', q: 'board', title: 'Board & exec' },
  { label: 'Data', q: 'data', title: 'Data & analytics' },
  { label: 'UI', q: 'ui', title: 'UI & product' },
  { label: 'Write', q: 'writer', title: 'Writing & comms' },
  { label: 'Meeting', q: 'meeting', title: 'Meetings' },
  { label: 'PM', q: 'project', title: 'Project management' }
]
