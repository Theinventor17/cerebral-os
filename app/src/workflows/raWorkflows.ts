import type { OrchestrationMode } from '../types'

export const ORCHESTRATION_MODES: { id: OrchestrationMode; label: string; blurb: string }[] = [
  { id: 'manual', label: 'Manual', blurb: 'User chooses the active agent for each turn.' },
  { id: 'leader', label: 'Leader', blurb: 'One lead agent delegates to others. (Placeholder)' },
  { id: 'planner_executor', label: 'Planner → Executor → Reviewer', blurb: 'Plan, execute, then review. (Placeholder)' },
  { id: 'debate', label: 'Debate', blurb: 'Multiple agents propose; Oracle or Sentinel selects. (Placeholder)' },
  { id: 'review_board', label: 'Review Board', blurb: 'Peer review the same output. (Placeholder)' },
  { id: 'parallel', label: 'Parallel', blurb: 'Subtasks in parallel. (Placeholder)' },
  { id: 'sequential', label: 'Sequential', blurb: 'Handoff chain. (Placeholder)' }
]
