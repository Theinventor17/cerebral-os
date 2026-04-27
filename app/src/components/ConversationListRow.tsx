import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AgentSession } from '../types'
import { DEFAULT_SESSION_TITLE } from '../services/sessionTitle'

type Props = {
  c: AgentSession
  isCurrent: boolean
  onSelect: () => void
  onRename: (sessionId: string, newTitle: string) => void | Promise<void>
  /** Full class for the row, including selected modifier (e.g. `cos-item cos-sel`). */
  className: string
  timeLabel: string
  /** `cos` = muted span; `cide` = `<small>`; `composer` = ccomp popover second line. */
  variant: 'cos' | 'cide' | 'composer'
  /** Conversation rows use a stacked (column) layout. */
  stacked?: boolean
  /**
   * When set, the title row is only the name (and pencil); the second line shows this
   * (e.g. time · Active). Used in Composer history popover.
   */
  subLabel?: string
}

export function ConversationListRow({ c, isCurrent, onSelect, onRename, className, timeLabel, variant, stacked, subLabel }: Props): ReactNode {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.title)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!editing) {
      setDraft(c.title)
    }
  }, [c.title, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = useCallback(async () => {
    const t = draft.trim() || DEFAULT_SESSION_TITLE
    setEditing(false)
    if (t !== c.title) {
      await onRename(c.id, t)
    }
  }, [c.id, c.title, draft, onRename])

  const onCancel = useCallback(() => {
    setEditing(false)
    setDraft(c.title)
  }, [c.title])

  const onRootKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect()
      }
    },
    [onSelect]
  )

  const isListboxOption = variant === 'composer'
  return (
    <div
      className={className}
      role={isListboxOption ? 'option' : 'button'}
      tabIndex={0}
      aria-selected={isListboxOption ? isCurrent : undefined}
      onClick={onSelect}
      onKeyDown={onRootKey}
      title={c.id}
      style={stacked ? { flexDirection: 'column', alignItems: 'stretch', gap: 2, minHeight: 36 } : undefined}
    >
      {editing ? (
        <input
          ref={inputRef}
          className={variant === 'cos' ? 'cos-inp' : undefined}
          style={
            variant === 'cide' || variant === 'composer'
              ? { width: '100%', fontSize: 12, padding: '2px 4px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 2, color: 'inherit' }
              : { width: '100%' }
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') {
              e.preventDefault()
              void commit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          aria-label="Conversation title"
        />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            width: '100%'
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'left',
              lineHeight: 1.3
            }}
          >
            {c.title || 'Conversation'}
            {subLabel == null && (
              <span style={variant === 'cos' ? { color: 'var(--text-muted)', fontWeight: 400 } : { fontWeight: 400 }}>
                {' '}
                · {c.endedAt ? 'Ended' : 'Active'}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDraft(c.title)
              setEditing(true)
            }}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              flex: 'none',
              padding: '0 4px',
              border: 'none',
              background: 'transparent',
              color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1,
              opacity: 0.6
            }}
            title="Rename conversation"
            aria-label="Rename conversation"
          >
            ✎
          </button>
        </div>
      )}
      {subLabel != null ? (
        <span
          className={variant === 'composer' ? 'ccomp-history-item-meta' : undefined}
          style={variant === 'cos' || variant === 'cide' ? { fontSize: variant === 'cos' ? 9 : undefined, color: 'var(--text-muted)' } : undefined}
        >
          {subLabel}
        </span>
      ) : variant === 'cos' ? (
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{timeLabel}</span>
      ) : (
        <small>{timeLabel}</small>
      )}
    </div>
  )
}
