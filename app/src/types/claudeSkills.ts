export type ClaudeSkillCatalogEntry = {
  id: string
  category: string
  slug: string
  name: string
  title: string
  description: string
  tags: string[]
  relativePath: string
  sourceUrl: string
  rawUrl: string
}

export type ClaudeSkillsCatalog = {
  generatedAt: string
  upstream: string
  count: number
  skills: ClaudeSkillCatalogEntry[]
}
