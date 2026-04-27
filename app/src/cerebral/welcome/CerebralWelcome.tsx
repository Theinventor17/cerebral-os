import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CerebralApi } from '../../../electron/preload'
import '../styles/cerebral-ide.css'
import { WindowChromeControls } from '../shell/WindowChromeControls'

type Recent = { name: string; path: string; openedAt: string }

/** Resolves the preload API (`cerebral` or legacy `cerbral` typo). */
function getCerebralApi(): CerebralApi | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }
  const w = window as unknown as { cerebral?: CerebralApi; cerbral?: CerebralApi }
  return w.cerebral ?? w.cerbral
}

export function CerebralWelcome(): ReactNode {
  const nav = useNavigate()
  const [recent, setRecent] = useState<Recent[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showAllRecents, setShowAllRecents] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')
  const [showClone, setShowClone] = useState(false)
  const [sshOpen, setSshOpen] = useState(false)
  const [hasWinChrome, setHasWinChrome] = useState(false)

  const loadRecent = useCallback(() => {
    void (async () => {
      try {
        const c = getCerebralApi()
        const r = c ? await c.workspace.recent() : []
        setRecent(Array.isArray(r) ? r : [])
      } catch {
        setRecent([])
      }
    })()
  }, [])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  useEffect(() => {
    const c = getCerebralApi()
    setHasWinChrome(!!c?.window && typeof c.window.minimize === 'function')
  }, [])

  const enterIde = useCallback(() => {
    nav('/cerebral/ide')
  }, [nav])

  const applyRoot = useCallback(
    async (rootPath: string, displayName?: string) => {
      setBusy(true)
      setErr(null)
      try {
        const c0 = getCerebralApi()
        if (!c0?.workspace?.setRoot) {
          setErr('Workspace API is not available. Run the CEREBRAL OS desktop app and restart if this persists.')
          return
        }
        const r = await c0.workspace.setRoot({ rootPath, displayName })
        if (!r.ok) {
          setErr(r.error)
          return
        }
        loadRecent()
        enterIde()
      } catch (e) {
        setErr((e as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [enterIde, loadRecent]
  )

  const onOpenProject = useCallback(async () => {
    setErr(null)
    const c = getCerebralApi()
    const pick = c?.pickWorkspaceDirectory ?? c?.workspace?.pickDirectory
    if (typeof pick !== 'function') {
      setErr(
        'Folder picker is not available. Use the CEREBRAL OS desktop app (not a normal browser tab). If you already are, quit and run `npm run dev` (or your packaged build) so the latest preload loads.'
      )
      return
    }
    try {
      const d = await pick()
      if (!d?.path) {
        return
      }
      await applyRoot(d.path)
    } catch (e) {
      setErr((e as Error).message || 'Could not open folder dialog.')
    }
  }, [applyRoot])

  const onRecent = useCallback(
    async (p: Recent) => {
      setErr(null)
      await applyRoot(p.path, p.name)
    },
    [applyRoot]
  )

  const onClone = useCallback(async () => {
    const url = cloneUrl.trim()
    if (!url) {
      setErr('Enter a Git repository URL.')
      return
    }
    const c = getCerebralApi()
    const pickParent = c?.pickDirectoryParent ?? c?.workspace?.pickDirectoryParent
    const gitClone = c?.workspace?.gitClone
    if (typeof pickParent !== 'function' || typeof gitClone !== 'function') {
      setErr('Clone requires the CEREBRAL OS desktop app (not a browser tab). Rebuild or reinstall if this persists.')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const d = await pickParent()
      if (!d?.path) {
        return
      }
      const r = await gitClone({ parentDir: d.path, url })
      if (!r.ok) {
        setErr(
          r.error +
            (String(r.error).toLowerCase().includes('git') || String(r.error).includes('ENOENT')
              ? ' — Install Git for Windows and/or add git.exe to your PATH, then restart the app.'
              : '')
        )
        return
      }
      loadRecent()
      enterIde()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [cloneUrl, enterIde, loadRecent])

  const visibleRecents = showAllRecents ? recent : recent.slice(0, 5)

  return (
    <div className="cw-root">
      {hasWinChrome && (
        <div className="cw-chrome">
          <WindowChromeControls />
        </div>
      )}
      <div className="cw-inner">
        <header className="cw-brand">
          <div className="cw-logo">CEREBRAL OS</div>
          <div className="cw-sub">
            <span className="cw-badge">Beta</span>
            <button type="button" className="cw-link" onClick={enterIde}>
              Open IDE
            </button>
            <span className="cw-dot">·</span>
            <span className="cw-hint">Choose a folder so the terminal and tools use the right directory.</span>
          </div>
        </header>

        {err && <div className="cw-err">{err}</div>}

        <div className="cw-actions">
          <button type="button" className="cw-card" disabled={busy} onClick={() => void onOpenProject()}>
            <span className="cw-ico" aria-hidden>
              ▸
            </span>
            <span className="cw-card-t">Open project</span>
            <span className="cw-card-d">Open a local folder as the active workspace</span>
          </button>
          <button
            type="button"
            className="cw-card"
            disabled={busy}
            onClick={() => {
              setShowClone((v) => !v)
              setErr(null)
            }}
          >
            <span className="cw-ico" aria-hidden>
              ⎇
            </span>
            <span className="cw-card-t">Clone repo</span>
            <span className="cw-card-d">Clone a Git repository into a folder you choose</span>
          </button>
          <button type="button" className="cw-card" disabled={busy} onClick={() => setSshOpen(true)}>
            <span className="cw-ico" aria-hidden>
              ◈
            </span>
            <span className="cw-card-t">Connect via SSH</span>
            <span className="cw-card-d">Remote development over SSH</span>
          </button>
        </div>

        {showClone && (
          <div className="cw-clone">
            <p className="cw-mute" style={{ margin: '0 0 8px', fontSize: 12, lineHeight: 1.45 }}>
              Git must be installed (e.g.{' '}
              <a href="https://git-scm.com/download/win" target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>
                Git for Windows
              </a>
              ). You will be asked to choose a <strong>parent</strong> folder; the repo is created inside it.
            </p>
            <input
              type="url"
              className="cw-input"
              placeholder="https://github.com/org/repo.git"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              disabled={busy}
            />
            <button type="button" className="cw-btn" disabled={busy} onClick={() => void onClone()}>
              Choose parent folder & clone
            </button>
          </div>
        )}

        <section className="cw-recent">
          <div className="cw-recent-h">
            <h2>Recent projects</h2>
            {recent.length > 5 && (
              <button type="button" className="cw-link" onClick={() => setShowAllRecents((v) => !v)}>
                {showAllRecents ? 'Show less' : `View all (${recent.length})`}
              </button>
            )}
          </div>
          {recent.length === 0 && <p className="cw-empty">No folders yet — open or clone a project above.</p>}
          <ul className="cw-list">
            {visibleRecents.map((r) => (
              <li key={r.path}>
                <button type="button" className="cw-row" disabled={busy} onClick={() => void onRecent(r)}>
                  <span className="cw-name">{r.name}</span>
                  <span className="cw-path">{r.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {sshOpen && (
        <div className="cw-modal-back" role="presentation" onClick={() => setSshOpen(false)}>
          <div
            className="cw-modal"
            role="dialog"
            aria-labelledby="cw-ssh-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cw-ssh-title">Connect via SSH</h3>
            <p className="cw-modal-p">
              In-app remote SSH (like VS Code Remote) is not available yet. To work on a machine over SSH: clone or sync the
              repo to this PC (for example <code>git clone</code> in a terminal using your SSH URL), or use scp/rsync, then
              use <strong>Open project</strong> and pick that folder. See also{' '}
              <a
                href="https://docs.github.com/en/authentication/connecting-to-github-with-ssh"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--cyan)' }}
              >
                GitHub SSH keys
              </a>
              .
            </p>
            <button type="button" className="cw-btn" onClick={() => setSshOpen(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
