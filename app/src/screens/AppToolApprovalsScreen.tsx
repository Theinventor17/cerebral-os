import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useResonantAgents } from '../providers/ResonantAgentsProvider'

export function AppToolApprovalsScreen(): ReactNode {
  const { openShellGate, activeAgent } = useResonantAgents()
  return (
    <div className="ra-screen">
      <h1 className="ra-h1" style={{ fontSize: 14, margin: '0 0 8px 0' }}>
        Tool approvals
      </h1>
      <p className="ra-mute" style={{ fontSize: 11, marginBottom: 12 }}>
        High-risk scopes (shell, files, browser) can require confirmation per agent. Active agent:{' '}
        <strong style={{ color: '#c4d0e0' }}>{activeAgent?.name ?? '—'}</strong>
      </p>
      <ul style={{ fontSize: 11, color: '#9fadc2', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
        <li>Shell and tool gates are recorded in the session store when triggered.</li>
        <li>Use the test control to verify the permission modal (dev builds).</li>
      </ul>
      <p style={{ marginTop: 12 }}>
        <button type="button" className="cide-btn" onClick={() => openShellGate()}>
          Test permission gate
        </button>
      </p>
      <p style={{ marginTop: 12, fontSize: 10 }}>
        <Link to="/app/session" style={{ color: '#6ab0ff' }}>
          Active session
        </Link>
        {' · '}
        <Link to="/app/settings" style={{ color: '#6ab0ff' }}>
          Settings
        </Link>
      </p>
    </div>
  )
}
