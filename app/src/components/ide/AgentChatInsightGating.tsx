import type { ReactNode } from 'react'
import { useResonantAgents } from '../../providers/ResonantAgentsProvider'
import { COPY_INSIGHT_OFF_HYBRID, COPY_INSIGHT_OFF_THOUGHT } from '@/cerebral/copy/insightModeCopy'

/**
 * Shared Insight / session-mode gating for any chat surface.
 * Canonical: `AgentChatWorkspace` in the Cerebral IDE. Legacy: `ResonantAgentsDashboard` / `ChannelPanel` uses the same copy.
 */
export type AgentChatGatingVariant = 'ide' | 'legacy'

export function AgentChatInsightHybridStrip({ variant }: { variant: AgentChatGatingVariant }): ReactNode {
  const { sessionMode, insightLive } = useResonantAgents()
  if (sessionMode !== 'hybrid' || insightLive) {
    return null
  }
  if (variant === 'ide') {
    return (
      <p className="ccomp-hint ccomp-hint--insight" role="status">
        {COPY_INSIGHT_OFF_HYBRID}
      </p>
    )
  }
  return (
    <p className="ra-mute" style={{ padding: '4px 8px 0', fontSize: 12, lineHeight: 1.45 }} role="status">
      {COPY_INSIGHT_OFF_HYBRID}
    </p>
  )
}

export function AgentChatInsightThoughtGating({ variant }: { variant: AgentChatGatingVariant }): ReactNode {
  const { sessionMode, insightLive, setSessionMode } = useResonantAgents()
  const thoughtBlocked = sessionMode === 'thought' && !insightLive
  if (!thoughtBlocked) {
    return null
  }
  if (variant === 'ide') {
    return (
      <div className="ccomp-insight-block" role="alert">
        <p className="ccomp-err ccomp-err--one">{COPY_INSIGHT_OFF_THOUGHT}</p>
        <div className="ccomp-insight-actions">
          <button type="button" className="ccomp-linkish" onClick={() => void setSessionMode('hybrid')}>
            Switch to Hybrid
          </button>
          <span className="ccomp-insight-sep" aria-hidden>
            ·
          </span>
          <button type="button" className="ccomp-linkish" onClick={() => void setSessionMode('manual')}>
            Switch to Manual
          </button>
        </div>
        <details className="ccomp-insight-details">
          <summary>Checklist</summary>
          <ol>
            <li>
              Top bar: cycle <strong>Mode</strong> to Manual or Hybrid to type without a live Insight stream.
            </li>
            <li>
              Left bar: <strong>◎ Headsets</strong> → connect EMOTIV and start a live stream to use Thought mode.
            </li>
          </ol>
        </details>
      </div>
    )
  }
  return (
    <div className="ra-err" style={{ padding: 8 }}>
      <p style={{ margin: '0 0 6px 0', lineHeight: 1.45 }}>{COPY_INSIGHT_OFF_THOUGHT}</p>
      <button type="button" className="ra-btn ra-btn-ghost" style={{ marginRight: 8 }} onClick={() => void setSessionMode('hybrid')}>
        Switch to Hybrid
      </button>
      <button type="button" className="ra-btn ra-btn-ghost" onClick={() => void setSessionMode('manual')}>
        Switch to Manual
      </button>
    </div>
  )
}

export function AgentChatSendErrorLine({ variant }: { variant: AgentChatGatingVariant }): ReactNode {
  const { sendError } = useResonantAgents()
  if (!sendError) {
    return null
  }
  if (variant === 'ide') {
    return <p className="ccomp-err">{sendError}</p>
  }
  return <div className="ra-err">{sendError}</div>
}
