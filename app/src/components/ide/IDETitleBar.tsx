import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useResonantAgents } from '../../providers/ResonantAgentsProvider'
import type { SessionMode } from '../../types'

export function IDETitleBar(): ReactNode {
  const { sessionMode, setSessionMode, localOnly, activeAgent, headsetLive, cortex, signalLock, eegLine } = useResonantAgents()
  const [provName, setProvName] = useState('—')

  const cycleMode = useCallback(() => {
    const order: SessionMode[] = ['manual', 'hybrid', 'thought']
    const i = order.indexOf(sessionMode)
    const n = i < 0 ? 0 : (i + 1) % order.length
    void setSessionMode(order[n])
  }, [sessionMode, setSessionMode])

  useEffect(() => {
    if (!activeAgent) {
      setProvName('—')
      return
    }
    let ok = true
    void (async () => {
      const list = (await window.ra.provider.list()) as Array<Record<string, unknown>>
      if (!ok) {
        return
      }
      const p = list.find((x) => String(x.id) === activeAgent.providerId)
      setProvName(p ? String(p.name) : activeAgent.modelName || '—')
    })()
    return () => {
      ok = false
    }
  }, [activeAgent])

  const modeLabel = sessionMode === 'thought' ? 'Thought' : sessionMode === 'hybrid' ? 'Hybrid' : 'Manual'
  const sig = signalLock == null ? '—' : `${Math.min(100, Math.round(signalLock <= 1 ? signalLock * 100 : signalLock))}%`
  const neural = cortex.ok && headsetLive ? 'Linked' : 'Idle'

  return (
    <header className="cide-titlebar" role="banner">
      <div className="cide-titlebar-brand">CEREBRAL OS</div>
      <div className="cide-cmd" title="Command palette (placeholder)">
        <input type="search" readOnly tabIndex={-1} placeholder="Ask, route, run, or configure…" aria-label="Command palette" />
      </div>
      <div className="cide-titlebar-chips">
        <button type="button" className="cide-chip-grad cide-on" onClick={cycleMode} title="Cycle Manual → Hybrid → Thought">
          Mode: <b>{modeLabel}</b>
        </button>
        <span className="cide-chip-grad" title="Model for active agent">
          Provider: <b>{provName}</b>
        </span>
        {localOnly && (
          <span className="cide-chip-grad" title="Cloud providers disabled in main process">
            <b>Local-only</b>
          </span>
        )}
        <span className="cide-chip-grad" title="EEG / headset path">
          Neural: <b>{neural}</b>
        </span>
        <span className="cide-chip-grad" title="Signal quality">
          Lock: <b>{sig}</b>
        </span>
        <span className="cide-chip-grad" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }} title={eegLine}>
          <b>{eegLine}</b>
        </span>
      </div>
    </header>
  )
}
