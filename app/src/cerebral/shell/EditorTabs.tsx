import type { ReactNode } from 'react'
import { useCerebralLayout } from '../context/CerebralTabContext'

export function EditorTabs(): ReactNode {
  const { tabs, activeTabId, setActiveTabId, closeTab } = useCerebralLayout()
  return (
    <div className="cos-tabs" role="tablist" aria-label="Editor tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTabId === t.id}
          className={`cos-tab ${activeTabId === t.id ? 'cos-tab-on' : ''}`.trim()}
          onClick={() => setActiveTabId(t.id)}
        >
          {t.title}
          {t.isDirty && <small>●</small>}
          <button
            type="button"
            className="cos-tab-close"
            aria-label="Close tab"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(t.id)
            }}
          >
            ×
          </button>
        </button>
      ))}
    </div>
  )
}
