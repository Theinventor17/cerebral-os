import claudeBundle from '@/data/claudeSkillsCatalog.json'
import type { ClaudeSkillCatalogEntry, ClaudeSkillsCatalog } from '@/types/claudeSkills'

const catalog = claudeBundle as ClaudeSkillsCatalog

export function getClaudeCatalog(): ClaudeSkillsCatalog {
  return catalog
}

export function getCatalogSkill(id: string): ClaudeSkillCatalogEntry | undefined {
  return catalog.skills.find((s) => s.id === id)
}

export function getCatalogSkillCount(): number {
  return catalog.count
}
