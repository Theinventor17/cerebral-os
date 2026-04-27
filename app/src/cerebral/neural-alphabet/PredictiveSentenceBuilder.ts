import type { NeuralAlphabetToken, PredictiveMode, SentenceCandidate } from './NeuralAlphabetTypes'

function newCandidateId(): string {
  if (globalThis.crypto?.randomUUID) {
    return `sc-${globalThis.crypto.randomUUID()}`
  }
  return `sc-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const BASE: Record<
  PredictiveMode,
  Record<string, (token: NeuralAlphabetToken) => { text: string; confidence: number; requiresConfirmation: boolean }[]>
> = {
  vibe: {
    push: () => [
      { text: 'Run the current code.', confidence: 0.75, requiresConfirmation: false },
      { text: 'Send this message to the agent.', confidence: 0.7, requiresConfirmation: false },
      { text: 'Continue building the current file.', confidence: 0.65, requiresConfirmation: false },
      { text: 'Explain the selected code.', confidence: 0.6, requiresConfirmation: false },
      { text: 'Open the integrated terminal and run the last command.', confidence: 0.55, requiresConfirmation: true }
    ],
    pull: () => [
      { text: 'Cancel the last suggestion.', confidence: 0.72, requiresConfirmation: false },
      { text: 'Close the debug panel and go back.', confidence: 0.65, requiresConfirmation: false },
      { text: 'Undo the last file edit.', confidence: 0.6, requiresConfirmation: false }
    ],
    left: () => [
      { text: 'Open the previous file in the editor.', confidence: 0.7, requiresConfirmation: false },
      { text: 'Step to the previous change.', confidence: 0.6, requiresConfirmation: false }
    ],
    right: () => [
      { text: 'Open the next file in the editor.', confidence: 0.7, requiresConfirmation: false },
      { text: 'Step to the next error or warning.', confidence: 0.62, requiresConfirmation: false }
    ],
    lift: () => [
      { text: 'Refactor and expand the selection.', confidence: 0.64, requiresConfirmation: true },
      { text: 'Increase test coverage for this area.', confidence: 0.58, requiresConfirmation: true }
    ],
    drop: () => [
      { text: 'Stop the running dev server.', confidence: 0.68, requiresConfirmation: true },
      { text: 'Pause the coding agent reply.', confidence: 0.6, requiresConfirmation: false }
    ],
    rotateLeft: () => [
      { text: 'Show the previous tab group.', confidence: 0.62, requiresConfirmation: false },
      { text: 'Scroll the problems list up.', confidence: 0.55, requiresConfirmation: false }
    ],
    rotateRight: () => [
      { text: 'Show the next tab group.', confidence: 0.62, requiresConfirmation: false },
      { text: 'Scroll the problems list down.', confidence: 0.55, requiresConfirmation: false }
    ],
    neutral: () => [{ text: 'Stand by — no action.', confidence: 0.3, requiresConfirmation: false }]
  },
  imagine: {
    push: () => [
      { text: 'Generate the image from this prompt.', confidence: 0.78, requiresConfirmation: false },
      { text: 'Create a new visual concept from the brief.', confidence: 0.72, requiresConfirmation: false },
      { text: 'Send this creative prompt to the model.', confidence: 0.68, requiresConfirmation: false },
      { text: 'Make another variation of the last output.', confidence: 0.64, requiresConfirmation: false }
    ],
    pull: () => [
      { text: 'Cancel this generation.', confidence: 0.7, requiresConfirmation: false },
      { text: 'Discard the draft and start over.', confidence: 0.6, requiresConfirmation: false }
    ],
    left: () => [
      { text: 'Load the previous prompt preset.', confidence: 0.58, requiresConfirmation: false }
    ],
    right: () => [
      { text: 'Load the next prompt preset.', confidence: 0.58, requiresConfirmation: false }
    ],
    lift: () => [
      { text: 'Add more detail and upscale the idea.', confidence: 0.62, requiresConfirmation: false }
    ],
    drop: () => [
      { text: 'Stop the current render or music generation.', confidence: 0.65, requiresConfirmation: true }
    ],
    rotateLeft: () => [
      { text: 'Show previous style reference.', confidence: 0.52, requiresConfirmation: false }
    ],
    rotateRight: () => [
      { text: 'Show next style reference.', confidence: 0.52, requiresConfirmation: false }
    ],
    neutral: () => [{ text: 'Idle — refine your prompt in chat.', confidence: 0.35, requiresConfirmation: false }]
  },
  execute: {
    push: () => [
      { text: 'open file explorer', confidence: 0.82, requiresConfirmation: true },
      { text: 'Run the selected command or workflow step.', confidence: 0.8, requiresConfirmation: true },
      { text: 'Open the selected app from the list.', confidence: 0.72, requiresConfirmation: true },
      { text: 'Confirm and execute this action.', confidence: 0.75, requiresConfirmation: true },
      { text: 'Run the current shell line in the project directory.', confidence: 0.68, requiresConfirmation: true }
    ],
    pull: () => [
      { text: 'Abort the pending system action.', confidence: 0.75, requiresConfirmation: false },
      { text: 'Reject this command proposal.', confidence: 0.7, requiresConfirmation: false }
    ],
    left: () => [
      { text: 'Select the previous command in the list.', confidence: 0.65, requiresConfirmation: false }
    ],
    right: () => [
      { text: 'Select the next command in the list.', confidence: 0.65, requiresConfirmation: false }
    ],
    lift: () => [
      { text: 'Request elevated permission for the next action.', confidence: 0.5, requiresConfirmation: true }
    ],
    drop: () => [
      { text: 'Halt the external workflow immediately.', confidence: 0.7, requiresConfirmation: true }
    ],
    rotateLeft: () => [
      { text: 'Previous batch of system commands.', confidence: 0.5, requiresConfirmation: false }
    ],
    rotateRight: () => [
      { text: 'Next batch of system commands.', confidence: 0.5, requiresConfirmation: false }
    ],
    neutral: () => [{ text: 'No execute action — review options.', confidence: 0.3, requiresConfirmation: false }]
  }
}

function linesFor(
  mode: PredictiveMode,
  cmd: string,
  token: NeuralAlphabetToken
): { text: string; confidence: number; requiresConfirmation: boolean }[] {
  const table = BASE[mode]
  const fns = table as unknown as Record<string, (t: NeuralAlphabetToken) => { text: string; confidence: number; requiresConfirmation: boolean }[]>
  const gen = fns[cmd]
  if (gen) {
    return gen(token)
  }
  return fns.neutral ? fns.neutral(token) : BASE.vibe.neutral(token)
}

/**
 * Produces 3–5 candidates for Thought / Hybrid; primary token drives phrasing.
 */
export function buildPredictiveCandidates(mode: PredictiveMode, token: NeuralAlphabetToken, limit = 5): SentenceCandidate[] {
  const cmd = token.mentalCommand
  const raw = linesFor(mode, cmd, token)
  const n = Math.min(Math.max(3, limit), 5, raw.length)
  const out: SentenceCandidate[] = raw.slice(0, n).map((o) => ({
    id: newCandidateId(),
    text: o.text,
    confidence: o.confidence * (0.85 + 0.15 * token.confidence),
    sourceTokens: [token],
    mode,
    requiresConfirmation: o.requiresConfirmation
  }))
  return out
}

/**
 * Re-score when multiple candidates are close in confidence (for clarification UI).
 */
export function shouldClarify(candidates: SentenceCandidate[]): boolean {
  if (candidates.length < 2) {
    return false
  }
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence)
  return sorted[0].confidence - sorted[1].confidence < 0.12
}
