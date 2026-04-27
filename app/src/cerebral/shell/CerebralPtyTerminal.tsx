import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

/**
 * Full interactive shell (Windows: PowerShell via node-pty + ConPTY) with xterm.js.
 */
export function CerebralPtyTerminal({
  workspaceRoot,
  clearTrigger,
}: {
  workspaceRoot: string | null
  clearTrigger?: number
}): ReactNode {
  const wrapRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<string | null>(null)
  const offDataRef = useRef<(() => void) | null>(null)
  const offExitRef = useRef<(() => void) | null>(null)
  const resizeObsRef = useRef<ResizeObserver | null>(null)
  const [meta, setMeta] = useState<{ cwd: string; shell: string } | null>(null)
  const [bootErr, setBootErr] = useState<string | null>(null)

  const killCurrent = useCallback(async () => {
    offDataRef.current?.()
    offDataRef.current = null
    offExitRef.current?.()
    offExitRef.current = null
    resizeObsRef.current?.disconnect()
    resizeObsRef.current = null
    termRef.current?.dispose()
    termRef.current = null
    fitRef.current = null
    const id = ptyIdRef.current
    ptyIdRef.current = null
    if (id && window.cerebral?.pty) {
      await window.cerebral.pty.kill({ id })
    }
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || !window.cerebral?.pty) {
      setBootErr('Interactive shell needs the desktop app with a current preload.')
      return
    }

    let gone = false
    let lastCols = 80
    let lastRows = 24

    void (async () => {
      setBootErr(null)
      await killCurrent()
      if (gone) {
        return
      }

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Consolas, "Cascadia Code", "Cascadia Mono", Menlo, monospace',
        theme: {
          background: '#0a0e14',
          foreground: '#e8f0ff',
          cursor: '#18c7ff',
          selectionBackground: 'rgba(24, 199, 255, 0.25)'
        },
        allowProposedApi: true
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(el)
      fit.fit()
      lastCols = term.cols
      lastRows = term.rows

      let cwd = workspaceRoot || undefined
      if (!cwd) {
        try {
          const w = await window.cerebral.workspace.default()
          cwd = w.rootPath || undefined
        } catch {
          // ignore
        }
      }
      if (gone) {
        term.dispose()
        return
      }

      const r = await window.cerebral.pty.spawn({
        cwd,
        cols: lastCols,
        rows: lastRows
      })
      if (gone) {
        term.dispose()
        return
      }
      if (!r.ok) {
        setBootErr(r.error)
        term.dispose()
        return
      }

      ptyIdRef.current = r.id
      setMeta({ cwd: r.cwd, shell: r.shell })
      termRef.current = term
      fitRef.current = fit

      term.onData((data) => {
        const id = ptyIdRef.current
        if (id) {
          void window.cerebral.pty.write({ id, data })
        }
      })

      offDataRef.current = window.cerebral.pty.onData((p) => {
        if (p.id === r.id) {
          term.write(p.data)
        }
      })
      offExitRef.current = window.cerebral.pty.onExit((ev) => {
        if (ev.id === r.id) {
          term.writeln(`\r\n\x1b[90m[Shell exited: code ${ev.code}]\x1b[0m`)
        }
      })

      resizeObsRef.current?.disconnect()
      resizeObsRef.current = new ResizeObserver(() => {
        if (gone || !termRef.current || !fitRef.current) {
          return
        }
        fitRef.current.fit()
        const t = termRef.current
        const id = ptyIdRef.current
        if (!id) {
          return
        }
        if (t.cols === lastCols && t.rows === lastRows) {
          return
        }
        lastCols = t.cols
        lastRows = t.rows
        void window.cerebral.pty.resize({ id, cols: lastCols, rows: lastRows })
      })
      resizeObsRef.current.observe(el)
    })()

    return () => {
      gone = true
      void killCurrent()
    }
  }, [workspaceRoot, killCurrent])

  const clearPrev = useRef<number | null>(null)
  useEffect(() => {
    if (clearTrigger === undefined) {
      return
    }
    if (clearPrev.current === null) {
      clearPrev.current = clearTrigger
      return
    }
    if (clearTrigger === clearPrev.current) {
      return
    }
    clearPrev.current = clearTrigger
    const id = ptyIdRef.current
    termRef.current?.clear()
    if (id) {
      void window.cerebral?.pty?.clear({ id })
    }
  }, [clearTrigger])

  return (
    <div className="cos-term-ide cos-term-pty" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="cos-term-toolbar">
        <span className="cos-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {meta ? `${meta.shell.toUpperCase()} · ${meta.cwd}` : 'Shell'}
        </span>
        {bootErr && (
          <span className="cos-mono" style={{ fontSize: 10, color: 'var(--danger)' }}>
            {bootErr}
          </span>
        )}
        <span className="cos-mono" style={{ fontSize: 10, color: '#5c6a7d', marginLeft: 'auto' }}>
          Interactive · resize to reflow · Ctrl+Shift+C / V copy/paste
        </span>
      </div>
      <div
        ref={wrapRef}
        className="cos-term-pty-xterm"
        style={{ flex: 1, minHeight: 0, width: '100%', padding: '4px 8px 8px', boxSizing: 'border-box' }}
      />
    </div>
  )
}
