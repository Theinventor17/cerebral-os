import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import type { CommandEncyclopediaEntry } from '@/cerebral/commands/CommandEncyclopediaTypes'
import { commandActionPreview } from '@/cerebral/commands/CommandEncyclopediaTypes'

const CONFIRM = 'CONFIRM'

type Props = {
  open: boolean
  sentence: string
  source: 'manual' | 'thought' | 'hybrid'
  entry: CommandEncyclopediaEntry
  onApprove: (typedConfirm: string | undefined) => void
  onReject: () => void
}

export function CommandConfirmationModal({
  open,
  sentence,
  source,
  entry,
  onApprove,
  onReject
}: Props): ReactNode {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) {
      setTyped('')
    }
  }, [open, entry.id])

  const isHigh = entry.riskLevel === 'high'
  const canApprove = !isHigh || typed === CONFIRM

  const done = useCallback(
    (approve: boolean) => {
      if (approve) {
        if (isHigh && typed !== CONFIRM) {
          return
        }
        onApprove(isHigh ? typed : undefined)
      } else {
        onReject()
      }
    },
    [isHigh, onApprove, onReject, typed]
  )

  if (!open) {
    return null
  }

  const preview = commandActionPreview(entry.action)

  return (
    <div
      className="ccomp-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10_000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command confirmation"
      onClick={() => onReject()}
    >
      <div
        className="ccomp-modal ccomp-elev-2"
        style={{
          maxWidth: 480,
          width: '100%',
          background: 'var(--ccomp-panel, #1a1a1c)',
          border: '1px solid var(--ccomp-line, #333)',
          borderRadius: 12,
          padding: 20
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="ccomp-h2" style={{ margin: '0 0 12px' }}>
          Run command
        </h2>
        <p style={{ margin: '0 0 8px', color: 'var(--ccomp-muted, #9a9a9a)', fontSize: 12 }}>From {source} session</p>
        <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>
          <div>
            <strong>Phrase</strong> — {entry.phrase}
          </div>
          <div>
            <strong>Your text</strong> — {sentence}
          </div>
          <div>
            <strong>Aliases matched</strong> — {entry.aliases.length ? entry.aliases.join(', ') : '—'}
          </div>
          <div>
            <strong>Mode</strong> — {entry.mode} · <strong>Category</strong> — {entry.category}
          </div>
          <div>
            <strong>Action</strong> — {entry.action.type} → {preview}
          </div>
          <div>
            <strong>Risk</strong> — {entry.riskLevel} · <strong>Requires confirmation</strong> —{' '}
            {entry.requiresConfirmation ? 'yes' : 'no'}
          </div>
        </div>
        {isHigh ? (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Type <code>{CONFIRM}</code> to run this high-risk action:
            </label>
            <input
              className="ccomp-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              style={{ width: '100%' }}
              autoFocus
            />
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="ccomp-btn" onClick={() => done(false)}>
            Cancel
          </button>
          <button type="button" className="ccomp-btn ccomp-btn-primary" disabled={!canApprove} onClick={() => done(true)}>
            Run
          </button>
        </div>
      </div>
    </div>
  )
}
