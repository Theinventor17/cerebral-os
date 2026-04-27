import type { ThoughtCommand, ThoughtCommandName, ThoughtCommandStatus } from '../types'
import { newId } from './mappers'

function ra() {
  return window.ra
}

export const ThoughtCommandRouter = {
  async upsert(
    sessionId: string,
    command: ThoughtCommandName,
    status: ThoughtCommandStatus,
    confidence: number | null,
    id?: string,
    sourceMetricsJson?: string | null
  ): Promise<ThoughtCommand> {
    const rowId = id ?? newId()
    const now = new Date().toISOString()
    await ra().thought.upsert({
      id: rowId,
      session_id: sessionId,
      command,
      confidence,
      status,
      source_metrics_json: sourceMetricsJson ?? null,
      created_at: now
    })
    return { id: rowId, sessionId, command, confidence, status, createdAt: now }
  },

  async listForSession(sessionId: string) {
    const rows = (await ra().thought.list(sessionId)) as Array<Record<string, unknown>>
    return rows
  }
}
