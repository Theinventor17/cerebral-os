import type { CommandEncyclopediaEntry } from './CommandEncyclopediaTypes'
import { COMMAND_ENCYCLOPEDIA_SEED } from './CommandEncyclopediaSeed'

function rowToEntry(r: Record<string, unknown>): CommandEncyclopediaEntry {
  return {
    id: String(r.id),
    phrase: String(r.phrase),
    aliases: JSON.parse(String(r.aliases_json)) as string[],
    mode: r.mode as CommandEncyclopediaEntry['mode'],
    category: r.category as CommandEncyclopediaEntry['category'],
    intent: String(r.intent),
    target: r.target == null || r.target === '' ? undefined : String(r.target),
    action: JSON.parse(String(r.action_json)) as CommandEncyclopediaEntry['action'],
    riskLevel: r.risk_level as CommandEncyclopediaEntry['riskLevel'],
    requiresConfirmation: Number(r.requires_confirmation) === 1,
    thoughtPatterns: r.thought_patterns_json
      ? (JSON.parse(String(r.thought_patterns_json)) as string[])
      : undefined,
    clarificationQuestion: r.clarification_question == null ? undefined : String(r.clarification_question),
    enabled: Number(r.enabled) === 1,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at)
  }
}

export function entryToDbRow(e: CommandEncyclopediaEntry): Record<string, unknown> {
  return {
    id: e.id,
    phrase: e.phrase,
    aliases_json: JSON.stringify(e.aliases),
    mode: e.mode,
    category: e.category,
    intent: e.intent,
    target: e.target ?? null,
    action_json: JSON.stringify(e.action),
    risk_level: e.riskLevel,
    requires_confirmation: e.requiresConfirmation ? 1 : 0,
    thought_patterns_json: e.thoughtPatterns ? JSON.stringify(e.thoughtPatterns) : null,
    clarification_question: e.clarificationQuestion ?? null,
    enabled: e.enabled ? 1 : 0,
    created_at: e.createdAt,
    updated_at: e.updatedAt
  }
}

let cached: CommandEncyclopediaEntry[] | null = null

export const CommandEncyclopediaService = {
  async ensureSeeded(): Promise<void> {
    const n = await window.ra.encyclopedia.count()
    if (n > 0) {
      return
    }
    const rows = COMMAND_ENCYCLOPEDIA_SEED.map((e) => entryToDbRow(e))
    await window.ra.encyclopedia.bulkSeed(rows)
  },

  async list(): Promise<CommandEncyclopediaEntry[]> {
    await this.ensureSeeded()
    const raw = (await window.ra.encyclopedia.list()) as Array<Record<string, unknown>>
    const list = raw.map(rowToEntry)
    cached = list
    return list
  },

  getCached(): CommandEncyclopediaEntry[] | null {
    return cached
  },

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await window.ra.encyclopedia.setEnabled({ id, enabled })
    cached = null
  }
}
