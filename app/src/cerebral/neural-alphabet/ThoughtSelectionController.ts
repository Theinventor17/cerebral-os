import type { EmotivMentalCommandName } from './NeuralAlphabetTypes'
import type { NeuralAlphabetToken, SentenceCandidate } from './NeuralAlphabetTypes'

export type ThoughtSelectionState = {
  candidates: SentenceCandidate[]
  selectedIndex: number
  clarificationMode: boolean
  lastToken: NeuralAlphabetToken | null
}

export function createInitialThoughtState(): ThoughtSelectionState {
  return {
    candidates: [],
    selectedIndex: 0,
    clarificationMode: false,
    lastToken: null
  }
}

/**
 * Maps mental command to list navigation / confirm / cancel.
 */
export function reduceThoughtSelection(
  state: ThoughtSelectionState,
  token: NeuralAlphabetToken | null
): { state: ThoughtSelectionState; effect?: 'confirm' | 'cancel' | 'refine' | 'none' } {
  if (!token) {
    return { state, effect: 'none' }
  }
  const m = token.mentalCommand
  const n = state.candidates.length
  if (n === 0) {
    return { state: { ...state, lastToken: token }, effect: 'none' }
  }
  const maxI = n - 1
  if (m === 'left' || m === 'rotateLeft') {
    return {
      state: {
        ...state,
        selectedIndex: Math.max(0, state.selectedIndex - 1),
        lastToken: token
      },
      effect: 'none'
    }
  }
  if (m === 'right' || m === 'rotateRight') {
    return {
      state: {
        ...state,
        selectedIndex: Math.min(maxI, state.selectedIndex + 1),
        lastToken: token
      },
      effect: 'none'
    }
  }
  if (m === 'push') {
    return { state: { ...state, lastToken: token }, effect: 'confirm' }
  }
  if (m === 'pull') {
    return { state: { ...state, lastToken: token }, effect: 'cancel' }
  }
  if (m === 'lift') {
    return { state: { ...state, clarificationMode: true, lastToken: token }, effect: 'refine' }
  }
  if (m === 'drop') {
    return { state, effect: 'cancel' }
  }
  if (m === 'neutral') {
    return { state: { ...state, lastToken: token }, effect: 'none' }
  }
  return { state: { ...state, lastToken: token }, effect: 'none' }
}

export function selectCandidateByIndex(
  state: ThoughtSelectionState,
  index: number
): ThoughtSelectionState {
  if (state.candidates.length === 0) {
    return state
  }
  return {
    ...state,
    selectedIndex: Math.max(0, Math.min(state.candidates.length - 1, index))
  }
}

export function mentalCommandToSelectionHint(m: EmotivMentalCommandName): string {
  const hints: Record<EmotivMentalCommandName, string> = {
    right: 'Next candidate',
    left: 'Previous candidate',
    push: 'Select / confirm',
    pull: 'Cancel / reject',
    lift: 'Expand / refine',
    drop: 'Stop / pause',
    rotateLeft: 'Scroll / cycle previous',
    rotateRight: 'Scroll / cycle next',
    neutral: 'Idle'
  }
  return hints[m] ?? m
}
