import type { ComposerWorkflowMode } from '@/types'

export type EmotivMentalCommandName =
  | 'push'
  | 'pull'
  | 'lift'
  | 'drop'
  | 'left'
  | 'right'
  | 'rotateLeft'
  | 'rotateRight'
  | 'neutral'

export type NeuralAlphabetToken = {
  id: string
  source: 'emotiv_insight'
  mentalCommand: EmotivMentalCommandName
  mappedMeanings: string[]
  confidence: number
  timestamp: string
}

export type PredictiveMode = 'vibe' | 'imagine' | 'execute'

export type SentenceCandidate = {
  id: string
  text: string
  confidence: number
  sourceTokens: NeuralAlphabetToken[]
  mode: PredictiveMode
  requiresConfirmation: boolean
  actionCandidateId?: string
}

export function workflowToPredictiveMode(w: ComposerWorkflowMode): PredictiveMode {
  if (w === 'vibe') {
    return 'vibe'
  }
  if (w === 'imagine') {
    return 'imagine'
  }
  return 'execute'
}
