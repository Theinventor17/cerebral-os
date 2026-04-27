import type { ReactNode } from 'react'

export function AppReportsScreen(): ReactNode {
  return (
    <div className="ra-screen">
      <h1 className="ra-h1" style={{ fontSize: 14, margin: '0 0 8px 0' }}>
        Report.md
      </h1>
      <p className="ra-mute" style={{ fontSize: 11, marginBottom: 8 }}>
        Session and swarm reports will be listed here. Placeholder for workspace export.
      </p>
      <pre
        style={{
          background: '#050a12',
          border: '1px solid #142236',
          padding: 12,
          borderRadius: 4,
          fontSize: 11,
          color: '#b0bed1',
          margin: 0,
          fontFamily: 'inherit',
          minHeight: 120,
          lineHeight: 1.4
        }}
      >
        {`# CEREBRAL OS\n\n- Agent run summaries\n- Swarm steps\n- Provider usage\n\n_(Generated reports will appear in a future build.)_`}
      </pre>
    </div>
  )
}
