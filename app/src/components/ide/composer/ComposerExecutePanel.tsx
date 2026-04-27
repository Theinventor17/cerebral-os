import { useCallback, useState, type ReactNode } from 'react'

const DEFAULT_URL = 'https://www.wikipedia.org/'

/**
 * Live browser surface for Execute mode. Future: wire Playwright/Selenium in main to drive the webview
 * and stream actions into this panel (IPC + CDP or remote debugging).
 */
export function ComposerExecutePanel(): ReactNode {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [editing, setEditing] = useState(url)

  const go = useCallback(() => {
    let t = editing.trim()
    if (!t) {
      return
    }
    if (!/^https?:\/\//i.test(t)) {
      t = 'https://' + t
    }
    if (!/^https?:\/\//i.test(t)) {
      return
    }
    setUrl(t)
    setEditing(t)
  }, [editing])

  return (
    <div className="ccomp-exec" aria-label="Execute mode live browser">
      <div className="ccomp-exec-bar">
        <span className="ccomp-exec-lab">Live browser</span>
        <input
          className="ccomp-exec-url"
          type="url"
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="https://"
          title="https URLs only in this build"
        />
        <button type="button" className="ccomp-exec-go" onClick={go}>
          Go
        </button>
        <span className="ccomp-exec-hint" title="Automation will attach here in a follow-up (Playwright / Selenium)">
          Automation hook (coming)
        </span>
      </div>
      <div className="ccomp-exec-frame">
        <webview className="ccomp-wv" src={url} style={{ width: '100%', height: '100%' }} allowpopups="false" />
      </div>
    </div>
  )
}
