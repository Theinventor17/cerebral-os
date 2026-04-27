import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { IdeCommandPalette } from './IdeCommandPalette'
import { useNavigate } from 'react-router-dom'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'
import type { SessionMode } from '@/types'
import { useIdeLayoutRuntime } from '../layout/IdeLayoutRuntimeContext'
import { IDEMenubar } from './IDEMenubar'
import { WindowChromeControls } from './WindowChromeControls'

function LayoutToggles(): ReactNode {
  const { leftPanelRef, rightPanelRef, bottomPanelRef, vertGroupRef } = useIdeLayoutRuntime()

  const toggle = (p: { current: { isCollapsed: () => boolean; collapse: () => void; expand: () => void } | null }) => {
    if (!p.current) {
      return
    }
    p.current.isCollapsed() ? p.current.expand() : p.current.collapse()
  }

  return (
    <div className="cos-ly" title="Layout">
      <button type="button" onClick={() => toggle(leftPanelRef)} title="Toggle left">
        L
      </button>
      <button type="button" onClick={() => toggle(rightPanelRef)} title="Toggle right">
        R
      </button>
      <button type="button" onClick={() => toggle(bottomPanelRef)} title="Toggle bottom">
        B
      </button>
      <button
        type="button"
        onClick={() => {
          vertGroupRef.current?.setLayout({ main: 88, bottom: 12 })
        }}
        title="Max editor"
      >
        ▢
      </button>
      <button
        type="button"
        onClick={() => {
          vertGroupRef.current?.setLayout({ main: 25, bottom: 75 })
        }}
        title="Max bottom"
      >
        ▭
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.removeItem('cerebral.layout.v1')
            window.location.reload()
          } catch {
            // ignore
          }
        }}
        title="Reset layout"
      >
        ↺
      </button>
    </div>
  )
}

export function CommandBar(): ReactNode {
  const nav = useNavigate()
  const { sessionMode, setSessionMode, localOnly, activeAgent, headsetLive, cortex, signalLock, eegLine } = useResonantAgents()
  const [provName, setProvName] = useState('—')
  const [paletteOpen, setPaletteOpen] = useState(false)

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
  const neural = cortex.ok && headsetLive ? 'Connected' : 'Idle'

  const onBrandDbl = useCallback(() => {
    void window.cerebral?.window?.maximizeToggle?.()
  }, [])

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <header className="cos-cmd" role="banner">
      <IdeCommandPalette open={paletteOpen} onClose={closePalette} />
      <div className="cos-cmd-menus">
        <div
          className="cos-brand"
          title="CEREBRAL OS — agent IDE (double-click to toggle maximize)"
          onDoubleClick={onBrandDbl}
        >
          CEREBRAL OS
        </div>
        <IDEMenubar onOpenCommandPalette={openPalette} />
      </div>
      <div className="cos-pal" title="Command palette — click or Ctrl+Shift+P">
        <button
          type="button"
          className="cos-pal-trigger"
          onClick={openPalette}
          aria-expanded={paletteOpen}
          aria-haspopup="dialog"
        >
          Ask, route, run, or configure…
        </button>
      </div>
      <LayoutToggles />
      <button type="button" className="cos-chip" title="Change project folder" onClick={() => nav('/cerebral/welcome')}>
        Project…
      </button>
      <div className="cos-chips">
        <button type="button" className="cos-chip cos-grad-on" onClick={cycleMode} title="Cycle Manual / Hybrid / Thought">
          <span>Mode: </span>
          <b>{modeLabel}</b>
        </button>
        <span className="cos-chip" title="Active agent provider">
          Provider: <b>{provName}</b>
        </span>
        {localOnly && (
          <span className="cos-chip" title="Cloud providers are disabled in main process">
            <b>Local-only</b>
          </span>
        )}
        <span className="cos-chip" title="EEG / headset link">
          Neural: <b>{neural}</b>
        </span>
        <span className="cos-chip" title="Signal quality (Cortex CQ when available)">
          Lock: <b>{sig}</b>
        </span>
        <span className="cos-chip" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={eegLine}>
          {eegLine}
        </span>
      </div>
      <WindowChromeControls />
    </header>
  )
}
