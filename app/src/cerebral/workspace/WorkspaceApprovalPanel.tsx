import type { ReactNode } from 'react'
import { useState } from 'react'
import type { WorkspaceAction } from './WorkspaceTypes'

function actionLabel(a: WorkspaceAction): { title: string; detail: string } {
  switch (a.type) {
    case 'write_file':
      return { title: 'Write file', detail: a.path + ` (${a.content.length} chars)` }
    case 'edit_file':
      return {
        title: 'Edit file',
        detail: `${a.path} — find: ${a.find.length > 80 ? a.find.slice(0, 80) + '…' : a.find}${a.replaceAll ? ' (all matches)' : ''}`
      }
    case 'delete_file':
      return { title: 'Delete file', detail: a.path }
    case 'create_directory':
      return { title: 'Create directory', detail: a.path }
    case 'run_command':
      return { title: 'Run command', detail: a.command }
    case 'open_file':
      return { title: 'Open in editor', detail: a.path }
    case 'read_file':
      return { title: 'Read file', detail: a.path }
  }
}

type Props = {
  actions: WorkspaceAction[]
  busy?: boolean
  onApproveAll: () => void
  onReject: () => void
  onApproveOne?: (index: number) => void
}

export function WorkspaceApprovalPanel({ actions, busy, onApproveAll, onReject, onApproveOne }: Props): ReactNode {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  if (actions.length === 0) {
    return null
  }

  return (
    <div
      className="cws-approval"
      style={{
        margin: '8px 0 12px',
        padding: 12,
        borderRadius: 8,
        border: '1px solid rgba(155, 92, 255, 0.45)',
        background: 'rgba(11, 20, 34, 0.95)',
        maxWidth: 720
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>Proposed changes</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ra-btn"
            disabled={!!busy}
            onClick={() => onApproveAll()}
            style={{ fontSize: 11 }}
          >
            Approve all
          </button>
          <button
            type="button"
            className="ra-btn ra-btn-ghost"
            disabled={!!busy}
            onClick={() => onReject()}
            style={{ fontSize: 11 }}
          >
            Reject
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-muted, #8a9ab0)' }}>
        These run in your local workspace folder. Nothing is applied until you approve. Delete and shell commands are only run
        if you press Approve.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {actions.map((a, i) => {
          const { title, detail } = actionLabel(a)
          const isDestr = a.type === 'delete_file' || a.type === 'run_command'
          return (
            <li
              key={`${a.type}-${i}`}
              style={{
                borderTop: i === 0 ? undefined : '1px solid rgba(255,255,255,0.08)',
                padding: '8px 0',
                fontSize: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <span style={{ color: isDestr ? '#ff8a7a' : '#7dd3a8' }}>{title}</span>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, marginTop: 4, color: '#c8d4e0' }}>{detail}</div>
                  {a.type === 'write_file' && (
                    <button
                      type="button"
                      className="ccomp-linkish"
                      style={{ fontSize: 10, marginTop: 4, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                      onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
                    >
                      {expanded[i] ? 'Hide preview' : 'Preview content'}
                    </button>
                  )}
                  {a.type === 'write_file' && expanded[i] && (
                    <pre
                      style={{
                        marginTop: 6,
                        maxHeight: 160,
                        overflow: 'auto',
                        fontSize: 10,
                        padding: 8,
                        background: '#050a12',
                        borderRadius: 4
                      }}
                    >
                      {a.content}
                    </pre>
                  )}
                </div>
                {onApproveOne && (
                  <button
                    type="button"
                    className="ra-btn ra-btn-ghost"
                    disabled={!!busy}
                    onClick={() => onApproveOne(i)}
                    style={{ fontSize: 10, flexShrink: 0 }}
                  >
                    Approve
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
