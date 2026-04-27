import type { AgentSwarm, OrchestrationMode } from '../types'

function ra() {
  return window.ra
}

export const SwarmOrchestrator = {
  async runPlaceholder(swarm: AgentSwarm) {
    return ra().orchestrateSwarmPlaceholder(swarm.id) as Promise<{
      ok: boolean
      runId?: string
      mode?: OrchestrationMode
      note?: string
    }>
  }
}
