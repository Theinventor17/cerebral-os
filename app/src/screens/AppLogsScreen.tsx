import type { ReactNode } from 'react'
import { useResonantAgents } from '../providers/ResonantAgentsProvider'

export function AppLogsScreen(): ReactNode {
  const { sendError, ollamaLabel, lmStudioUp, openRouterEnabled, cortex } = useResonantAgents()
  return (
    <div className="ra-screen">
      <h1 className="ra-h1" style={{ fontSize: 14, margin: '0 0 8px 0' }}>
        Logs
      </h1>
      <p className="ra-mute" style={{ fontSize: 11, marginBottom: 12 }}>
        Provider and integration status. Full stream is split with the bottom panel.
      </p>
      <pre
        style={{
          background: '#000309',
          border: '1px solid #142236',
          padding: 10,
          borderRadius: 4,
          fontSize: 10,
          color: '#8fa3b8',
          margin: 0,
          minHeight: 80,
          whiteSpace: 'pre-wrap'
        }}
      >
        {sendError
          ? `Error: ${sendError}\n`
          : 'No application errors in this view.\n'}
        Ollama: {ollamaLabel}
        {'\n'}
        LM Studio: {lmStudioUp == null ? 'n/a' : lmStudioUp ? 'up' : 'down'}
        {'\n'}
        OpenRouter: {openRouterEnabled ? 'on' : 'off'}
        {'\n'}
        Cortex: {cortex.ok ? 'ok' : 'unavailable'}
      </pre>
    </div>
  )
}
