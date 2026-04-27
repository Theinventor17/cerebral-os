import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { WebviewTag } from 'electron'
import { useCerebralLayout } from '../context/CerebralTabContext'
import type { CerebralTab } from '../types/cerebral.ts'

const DEFAULT_URL = 'http://127.0.0.1:3000/'

/** Accept http(s), about:, and file: for local static previews. */
function normalizeUserUrl(raw: string): string | null {
  let t = raw.trim()
  if (!t) {
    return null
  }
  if (!/^[a-zA-Z][\w+.-]*:/.test(t) && (t.startsWith('localhost') || t.includes('.') || /^\d/.test(t))) {
    t = 'http://' + t
  }
  try {
    const u = new URL(t)
    const ok = u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'file:' || u.protocol === 'about:'
    if (!ok) {
      return null
    }
    return u.toString()
  } catch {
    return null
  }
}

function titleForUrl(u: string): string {
  try {
    if (u.startsWith('about:')) {
      return 'Browser'
    }
    const h = new URL(u).hostname
    return h || 'Browser'
  } catch {
    return 'Browser'
  }
}

type Wv = WebviewTag

export function WorkspaceBrowserPanel({ tab }: { tab: CerebralTab }): ReactNode {
  const { updateTab } = useCerebralLayout()
  const initial = String(
    tab.data?.['url'] && String(tab.data['url']).trim() ? tab.data['url'] : DEFAULT_URL
  )
  const [editing, setEditing] = useState(initial)
  const [activeSrc, setActiveSrc] = useState(initial)
  const wvRef = useRef<HTMLElement | null>(null)
  const [canBack, setCanBack] = useState(false)
  const [canFwd, setCanFwd] = useState(false)
  const tabId = tab.id
  const lastWrittenUrl = useRef<string | null>(null)

  useEffect(() => {
    const u = String(
      tab.data?.['url'] && String(tab.data['url']).trim() ? tab.data['url'] : DEFAULT_URL
    )
    setEditing(u)
    setActiveSrc(u)
    lastWrittenUrl.current = null
  }, [tabId, tab.data?.['url']])

  const wv = () => wvRef.current as Wv | null

  const updateNav = useCallback(() => {
    const w = wv()
    if (!w) {
      return
    }
    setCanBack(w.canGoBack())
    setCanFwd(w.canGoForward())
  }, [])

  const persistUrl = useCallback(
    (u: string) => {
      if (lastWrittenUrl.current === u) {
        return
      }
      lastWrittenUrl.current = u
      const tit = titleForUrl(u)
      updateTab(tabId, { data: { url: u }, title: tit })
    },
    [tabId, updateTab]
  )

  const bindWebview = useCallback(
    (w: Wv) => {
      const onNav = () => {
        const u = w.getURL()
        if (u) {
          setEditing(u)
          persistUrl(u)
        }
        updateNav()
      }
      const onDidNav: Parameters<Wv['addEventListener']>[1] = (e) => {
        const url = (e as { url?: string }).url
        if (url) {
          setEditing(url)
          persistUrl(url)
        }
        updateNav()
      }
      w.addEventListener('did-navigate', onDidNav)
      w.addEventListener('did-navigate-in-page', onDidNav)
      w.addEventListener('did-finish-load', onNav)
      onNav()
      return () => {
        w.removeEventListener('did-navigate', onDidNav)
        w.removeEventListener('did-navigate-in-page', onDidNav)
        w.removeEventListener('did-finish-load', onNav)
      }
    },
    [persistUrl, updateNav]
  )

  useLayoutEffect(() => {
    const el = wvRef.current
    if (!el) {
      return
    }
    return bindWebview(el as unknown as Wv)
  }, [activeSrc, bindWebview, tabId])

  const go = useCallback(() => {
    const t = normalizeUserUrl(editing)
    if (!t) {
      return
    }
    setEditing(t)
    const w = wv()
    if (w?.loadURL) {
      w.loadURL(t)
    } else {
      setActiveSrc(t)
    }
    lastWrittenUrl.current = null
    persistUrl(t)
  }, [editing, persistUrl])

  const onBack = useCallback(() => {
    try {
      wv()?.goBack()
    } catch {
      // ignore
    }
    setTimeout(updateNav, 100)
  }, [updateNav])

  const onFwd = useCallback(() => {
    try {
      wv()?.goForward()
    } catch {
      // ignore
    }
    setTimeout(updateNav, 100)
  }, [updateNav])

  const onReload = useCallback(() => {
    try {
      wv()?.reload()
    } catch {
      // ignore
    }
  }, [])

  const openExternal = useCallback(() => {
    const t = normalizeUserUrl(editing) ?? activeSrc
    if (t) {
      void window.cerebral?.shell?.openExternal(t)
    }
  }, [editing, activeSrc])

  return (
    <div
      className="cos-embed"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, background: '#0a0a0a' }}
      aria-label="Simple browser"
    >
      <div className="ccomp-exec-bar" style={{ flex: 'none' }}>
        <span className="ccomp-exec-lab">Simple browser</span>
        <button type="button" className="cos-browser-nav" title="Back" disabled={!canBack} onClick={onBack}>
          ←
        </button>
        <button type="button" className="cos-browser-nav" title="Forward" disabled={!canFwd} onClick={onFwd}>
          →
        </button>
        <button type="button" className="cos-browser-nav" title="Reload" onClick={onReload}>
          ↻
        </button>
        <input
          className="ccomp-exec-url"
          type="url"
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="https:// or http://127.0.0.1:3000"
        />
        <button type="button" className="ccomp-exec-go" onClick={go}>
          Go
        </button>
        <button
          type="button"
          className="ccomp-exec-go"
          title="Open in system browser"
          onClick={openExternal}
        >
          External
        </button>
        <span className="ccomp-exec-hint" style={{ flex: '1 1 100%', margin: 0 }}>
          Use your app dev URL (Vite, Next, etc.); output shows in the terminal.
        </span>
      </div>
      <div className="ccomp-exec-frame" style={{ flex: 1, minHeight: 0 }}>
        <webview
          ref={(el: HTMLElement | null) => {
            wvRef.current = el
          }}
          className="ccomp-wv"
          src={activeSrc}
          style={{ width: '100%', height: '100%' }}
          allowpopups="false"
        />
      </div>
    </div>
  )
}
