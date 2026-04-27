import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { EditorTabs } from './EditorTabs'
import { EditorTabBody } from './EditorTabBody'
import { useCerebralLayout } from '../context/CerebralTabContext'

export function EditorWorkspace(): ReactNode {
  const { tabs, activeTabId } = useCerebralLayout()
  const active = useMemo(() => tabs.find((t) => t.id === activeTabId) ?? null, [tabs, activeTabId])

  return (
    <div className="cos-center">
      <EditorTabs />
      <div className="cos-work">
        {!active && (
          <div className="cos-empty">
            <p>Open an agent, file, swarm, or provider to begin.</p>
            <pre className="cos-welcome">
              {`CEREBRAL OS — Agent IDE
Keyboard chat works in Manual / Hybrid without a headset.
Thought mode is optional and uses the neural link when available.

Split layout placeholder →`}
            </pre>
            <div className="cos-split">
              <div style={{ flex: 1, minWidth: 0 }} />
              <div className="split-placeholder">Split</div>
            </div>
          </div>
        )}
        {active && <EditorTabBody tab={active} />}
      </div>
    </div>
  )
}
