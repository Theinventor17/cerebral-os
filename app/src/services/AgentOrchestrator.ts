import type { ResonantAgent } from '../types'

/**
 * Coordinates the intent → route → select → execute flow (skeleton; tool execution is gated).
 */
export const AgentOrchestrator = {
  describePipeline(): string {
    return 'Intent Router → Agent Selector → Orchestrator → response / gated tools → memory → session summary'
  },

  nextTurnHint(_active: ResonantAgent): { approvalRequired: boolean; toolExecution: string } {
    return { approvalRequired: true, toolExecution: 'Tool execution placeholder.' }
  }
}
