import type { AgentPermission, AgentPermissionScope, AgentSession } from '../types'
import { newId } from './mappers'

function ra() {
  return window.ra
}

export const AgentPermissionService = {
  checkScope(
    permissions: AgentPermission[],
    scope: AgentPermissionScope
  ): { mode: AgentPermission['mode']; label: string } {
    const p = permissions.find((x) => x.scope === scope)
    return { mode: p?.mode ?? 'ask_each_time', label: p?.label ?? scope }
  },

  isShellEnabled(): boolean {
    return false
  },

  async recordGateEvent(
    session: AgentSession,
    agentId: string | undefined,
    scope: AgentPermissionScope,
    action: 'approved' | 'denied' | 'blocked',
    detail?: string
  ): Promise<void> {
    await ra().toolApproval.insert({
      id: newId(),
      session_id: session.id,
      agent_id: agentId ?? null,
      tool_scope: scope,
      action,
      details_json: detail ? JSON.stringify({ message: detail }) : null,
      created_at: new Date().toISOString()
    })
  }
}
