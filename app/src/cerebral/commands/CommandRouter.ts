import type { CommandEncyclopediaEntry } from './CommandEncyclopediaTypes'
import { canExecuteFromThoughtStream } from './CommandPermissionGate'

export const CommandRouter = {
  /** Alias for {@link findByPhrase} (Command Execution Confirmation flow). */
  match(
    entries: CommandEncyclopediaEntry[],
    text: string
  ): { entry: CommandEncyclopediaEntry; score: number } | null {
    return CommandRouter.findByPhrase(entries, text)
  },

  findByPhrase(
    entries: CommandEncyclopediaEntry[],
    text: string
  ): { entry: CommandEncyclopediaEntry; score: number } | null {
    const t = text.trim().toLowerCase()
    if (!t) {
      return null
    }
    let best: { entry: CommandEncyclopediaEntry; score: number } | null = null
    for (const e of entries) {
      if (!e.enabled) {
        continue
      }
      if (e.phrase.toLowerCase() === t) {
        return { entry: e, score: 1 }
      }
      const aliasHit = e.aliases.some((a) => a.toLowerCase() === t)
      if (aliasHit) {
        best = { entry: e, score: 0.9 }
        continue
      }
      if (e.phrase.toLowerCase().includes(t) && t.length > 2) {
        if (!best || 0.5 > best.score) {
          best = { entry: e, score: 0.5 }
        }
      }
    }
    return best
  },

  canDispatchThought(
    entry: CommandEncyclopediaEntry,
    explicitUserConfirmed: boolean
  ): ReturnType<typeof canExecuteFromThoughtStream> {
    return canExecuteFromThoughtStream(entry, explicitUserConfirmed)
  }
}
