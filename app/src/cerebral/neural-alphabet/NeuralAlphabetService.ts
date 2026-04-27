import type { NeuralAlphabetToken, SentenceCandidate } from './NeuralAlphabetTypes'
import { newId } from '@/services/mappers'

function ts(): string {
  return new Date().toISOString()
}

export const NeuralAlphabetService = {
  async logToken(sessionId: string | null, token: NeuralAlphabetToken): Promise<void> {
    await window.ra.neuralLog.alphabet({
      id: newId(),
      session_id: sessionId,
      token_json: JSON.stringify(token),
      created_at: ts()
    })
  },

  async logCandidateBatch(
    sessionId: string | null,
    batchId: string,
    primary: SentenceCandidate
  ): Promise<void> {
    await window.ra.neuralLog.sentence({
      id: newId(),
      session_id: sessionId,
      batch_id: batchId,
      candidate_json: JSON.stringify(primary),
      created_at: ts()
    })
  },

  async logSelectionEvent(
    sessionId: string | null,
    eventType: 'confirm' | 'cancel' | 'nav' | 'refine' | 'keyboard' | 'command_result' | 'command_dismiss',
    payload: Record<string, unknown>
  ): Promise<void> {
    await window.ra.neuralLog.selection({
      id: newId(),
      session_id: sessionId,
      event_type: eventType,
      payload_json: JSON.stringify(payload),
      created_at: ts()
    })
  }
}
