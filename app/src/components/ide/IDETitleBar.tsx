import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useResonantAgents } from '../../providers/ResonantAgentsProvider'
import type { SessionMode } from '../../types'

const MODE_BLURBS: { id: SessionMode; title: string; body: string }[] = [
  {
    id: 'manual',
    title: 'Manual',
    body: 'Keyboard only — no neural sentence assembly from the headset. Use this without hardware or when Insight is off.'
  },
  {
    id: 'hybrid',
    title: 'Hybrid',
    body: 'Keyboard + neural when a live EMOTIV Insight stream is available; otherwise you type as usual (same as Manual for input until Insight is live).'
  },
  {
    id: 'thought',
    title: 'Thought',
    body: 'Neural-first — sending without a live Insight stream is blocked. Open ◎ Headsets to connect, or switch to Manual / Hybrid to type.'
  }
]

export function IDETitleBar(): ReactNode {
  const { sessionMode, setSessionMode, localOnly, activeAgent, headsetLive, cortex, signalLock, eegLine } = useResonantAgents()
  const [provName, setProvName] = useState('—')
  const [modeHelpOpen, setModeHelpOpen] = useState(false)
  const modeHelpRef = useRef<HTMLSpanElement | null>(null)

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

  useEffect(() => {
    if (!modeHelpOpen) {
      return
    }
    const onDown = (e: MouseEvent) => {
      if (modeHelpRef.current && !modeHelpRef.current.contains(e.target as Node)) {
        setModeHelpOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModeHelpOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [modeHelpOpen])

  const modeLabel = sessionMode === 'thought' ? 'Thought' : sessionMode === 'hybrid' ? 'Hybrid' : 'Manual'
  const sig = signalLock == null ? '—' : `${Math.min(100, Math.round(signalLock <= 1 ? signalLock * 100 : signalLock))}%`
  const neural = cortex.ok && headsetLive ? 'Linked' : 'Idle'
  const modeTitle =
    'Cycle session mode. Manual = keyboard; Hybrid = keyboard + neural when live; Thought = needs live Insight. Click ? for details.'

  return (
    <header className="cide-titlebar" role="banner">
      <div className="cide-titlebar-brand">CEREBRAL OS</div>
      <div className="cide-cmd" title="Command palette (placeholder)">
        <input type="search" readOnly tabIndex={-1} placeholder="Ask, route, run, or configure…" aria-label="Command palette" />
      </div>
      <div className="cide-titlebar-chips">
        <span className="cide-mode-wrap" ref={modeHelpRef}>
          <button type="button" className="cide-chip-grad cide-on" onClick={cycleMode} title={modeTitle}>
            Mode: <b>{modeLabel}</b>
          </button>
          <button
            type="button"
            className="cide-mode-help"
            aria-label="What is session mode?"
            aria-expanded={modeHelpOpen}
            title="What is Manual, Hybrid, Thought?"
            onClick={(e) => {
              e.stopPropagation()
              setModeHelpOpen((o) => !o)
            }}
          >
            ?
          </button>
          {modeHelpOpen && (
            <div className="cide-mode-popover" role="dialog" aria-label="Session mode">
              {MODE_BLURBS.map((m) => (
                <div key={m.id} className="cide-mode-poprow">
                  <div className="cide-mode-ptitle">{m.title}</div>
                  <p className="cide-mode-pbody">{m.body}</p>
                </div>
              ))}
              <p className="cide-mode-pfoot">Click the <strong>Mode</strong> chip to cycle: Manual → Hybrid → Thought.</p>
            </div>
          )}
        </span>
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
