import type { CommandEncyclopediaEntry } from './CommandEncyclopediaTypes'

/**
 * High-risk and destructive operations must not run from a single thought / neural event.
 * Shell and socket actions from thought still require an explicit in-app confirm step.
 */
export function canExecuteFromThoughtStream(entry: CommandEncyclopediaEntry, explicitUserConfirmed: boolean): {
  allowed: boolean
  reason: string
} {
  if (!entry.enabled) {
    return { allowed: false, reason: 'Command is disabled in the encyclopedia.' }
  }
  if (entry.riskLevel === 'high') {
    if (!explicitUserConfirmed) {
      return { allowed: false, reason: 'High-risk action requires explicit confirmation in the app.' }
    }
  }
  if (entry.requiresConfirmation && !explicitUserConfirmed) {
    return { allowed: false, reason: 'This action requires confirmation.' }
  }
  if (entry.action.type === 'shell' && !explicitUserConfirmed) {
    return { allowed: false, reason: 'Shell commands must be confirmed before use.' }
  }
  return { allowed: true, reason: '' }
}

export function isDestructiveSystemIntent(intent: string): boolean {
  const t = intent.toLowerCase()
  return (
    t.includes('shutdown') ||
    t.includes('restart') ||
    t.includes('sleep system') ||
    t.includes('power off')
  )
}
