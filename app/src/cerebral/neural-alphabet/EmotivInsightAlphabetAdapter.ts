import type { EmotivMentalCommandName, NeuralAlphabetToken } from './NeuralAlphabetTypes'

function newTokenId(): string {
  if (globalThis.crypto?.randomUUID) {
    return `nat-${globalThis.crypto.randomUUID()}`
  }
  return `nat-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const MEANINGS: Record<EmotivMentalCommandName, string[]> = {
  push: ['select', 'send', 'confirm', 'execute', 'open', 'run'],
  pull: ['cancel', 'reject', 'go back', 'undo', 'close'],
  lift: ['more', 'expand', 'increase', 'continue upward', 'make stronger'],
  drop: ['stop', 'reduce', 'lower', 'pause', 'minimize'],
  left: ['previous', 'move left', 'switch previous', 'back'],
  right: ['next', 'move right', 'continue', 'switch next'],
  rotateLeft: ['cycle previous group', 'scroll up', 'rewind'],
  rotateRight: ['cycle next group', 'scroll down', 'advance'],
  neutral: ['idle', 'no selection']
}

/** Normalize EMOTIV Cortex / mental command labels to the neural alphabet. */
export function normalizeMentalKey(raw: string | undefined | null): EmotivMentalCommandName | null {
  if (!raw || typeof raw !== 'string') {
    return null
  }
  const k = raw.trim().toLowerCase().replace(/\s+/g, '')
  const map: Record<string, EmotivMentalCommandName> = {
    push: 'push',
    pull: 'pull',
    lift: 'lift',
    drop: 'drop',
    left: 'left',
    right: 'right',
    rotateleft: 'rotateLeft',
    rotatel: 'rotateLeft',
    rleft: 'rotateLeft',
    rotateright: 'rotateRight',
    rotater: 'rotateRight',
    rright: 'rotateRight',
    neutral: 'neutral'
  }
  return map[k] ?? null
}

/**
 * @param com — Cortex `com` object: mapping action name to power, or { action, power } from frame
 */
export function mapCortexMentalToToken(
  com: unknown,
  confidence: number,
  timeIso: string
): NeuralAlphabetToken | null {
  if (com == null) {
    return null
  }
  let bestKey: string | null = null
  let bestPower = 0
  if (typeof com === 'object' && !Array.isArray(com)) {
    const o = com as Record<string, unknown>
    for (const [key, v] of Object.entries(o)) {
      const p = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(p) && p > bestPower) {
        bestPower = p
        bestKey = key
      }
    }
  }
  if (!bestKey || bestPower < 0.2) {
    return null
  }
  const mental = normalizeMentalKey(bestKey)
  if (!mental) {
    return null
  }
  return {
    id: newTokenId(),
    source: 'emotiv_insight',
    mentalCommand: mental,
    mappedMeanings: [...(MEANINGS[mental] ?? [])],
    confidence: Math.min(1, Math.max(0, confidence)),
    timestamp: timeIso
  }
}

/** Build a token from a single action name + power (e.g. from `NormalizedEEGFrame.mentalCommand`). */
export function buildTokenFromMentalAction(action: string, power: number, timeIso: string): NeuralAlphabetToken | null {
  if (!action || power < 0.2) {
    return null
  }
  return mapCortexMentalToToken({ [action]: power }, power, timeIso)
}

export { MEANINGS as NEURAL_ALPHABET_MEANINGS }
