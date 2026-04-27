import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'

/**
 * Minimize / maximize / close for frameless Electron windows (Cursor-style).
 */
export function WindowChromeControls(): ReactNode {
  const [maximized, setMaximized] = useState(false)

  const w = typeof window !== 'undefined' ? window.cerebral?.window : undefined

  useEffect(() => {
    if (!w?.getState) {
      return
    }
    void w.getState().then((s) => {
      if (s && 'ok' in s && s.ok && 'maximized' in s) {
        setMaximized(!!s.maximized)
      }
    })
    const off = w.onState?.((p) => setMaximized(!!p.maximized))
    return () => {
      off?.()
    }
  }, [])

  const onMin = useCallback(() => {
    void w?.minimize?.()
  }, [w])

  const onMax = useCallback(() => {
    void w?.maximizeToggle?.().then((r) => {
      if (r && 'ok' in r && r.ok && 'maximized' in r) {
        setMaximized(!!r.maximized)
      }
    })
  }, [w])

  const onClose = useCallback(() => {
    void w?.close?.()
  }, [w])

  if (!w?.minimize) {
    return null
  }

  return (
    <div className="cos-win-ctrl" role="group" aria-label="Window">
      <button type="button" className="cos-win-btn cos-win-min" title="Minimize" aria-label="Minimize" onClick={onMin}>
        <span className="cos-win-ico" aria-hidden>
          &#x2013;
        </span>
      </button>
      <button type="button" className="cos-win-btn cos-win-max" title={maximized ? 'Restore' : 'Maximize'} aria-label="Maximize" onClick={onMax}>
        <span className="cos-win-ico" aria-hidden>
          {maximized ? '\u29C9' : '\u25A1'}
        </span>
      </button>
      <button type="button" className="cos-win-btn cos-win-close" title="Close" aria-label="Close" onClick={onClose}>
        <span className="cos-win-ico" aria-hidden>
          &#x2715;
        </span>
      </button>
    </div>
  )
}
