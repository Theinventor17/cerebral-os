import { AgentRuntimeService } from '@/services/AgentRuntimeService'
import type { ResonantAgent } from '@/types'
import { executeWorkspaceAction } from './WorkspaceFileSystem'
import type { WorkspaceAction } from './WorkspaceTypes'

export const WORKSPACE_PROPOSAL_FOOTER =
  '\n\n---\n**Proposed workspace changes** are shown in the panel below. Review and **Approve** to apply them to your project folder.\n'

export async function executeApprovedWorkspaceActions(
  actions: WorkspaceAction[],
  ctx: {
    sessionId: string
    activeAgent: ResonantAgent
    onOpenFile: (relativePath: string) => void
    onCommandChunk?: (stream: 'stdout' | 'stderr', data: string) => void
  }
): Promise<string> {
  const lines: string[] = []
  for (const action of actions) {
    if (action.type === 'open_file') {
      ctx.onOpenFile(action.path.replace(/\\/g, '/'))
    }
    const { lines: L } = await executeWorkspaceAction(action, {
      onCommandChunk: ctx.onCommandChunk
    })
    lines.push(...L)
  }
  const summary = ['', '---', '**Workspace execution**', ...lines].join('\n').trim()
  await AgentRuntimeService.appendAssistantMessage(ctx.sessionId, ctx.activeAgent, summary)
  try {
    window.dispatchEvent(new CustomEvent('cerebral:workspace:mutated', { detail: { actionCount: actions.length } }))
  } catch {
    // ignore
  }
  return summary
}
