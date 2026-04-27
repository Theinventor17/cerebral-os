import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { commandActionPreview, type CommandEncyclopediaEntry } from './CommandEncyclopediaTypes'
import { CommandEncyclopediaService } from './CommandEncyclopediaService'

export function CommandEncyclopediaScreen(): ReactNode {
  const [rows, setRows] = useState<CommandEncyclopediaEntry[]>([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      setRows(await CommandEncyclopediaService.list())
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) {
      return rows
    }
    return rows.filter(
      (r) =>
        r.phrase.toLowerCase().includes(t) ||
        r.aliases.some((a) => a.toLowerCase().includes(t)) ||
        r.intent.toLowerCase().includes(t) ||
        r.category.toLowerCase().includes(t)
    )
  }, [rows, q])

  return (
    <div className="ra-screen" style={{ padding: 16, maxWidth: 900 }}>
      <h1 className="ra-h1">Command encyclopedia</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted, #6f8097)' }}>
        Seeded system phrases → actions. High-risk and shell steps require in-app confirmation when triggered from thought.
      </p>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <input
          type="search"
          placeholder="Search phrase, alias, category…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, padding: 8, background: '#0b1422', color: '#e6ecf6', border: '1px solid #1b2b42' }}
        />
        <button type="button" className="cos-chip" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {err && <p className="ccomp-err">{err}</p>}
      <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
        <table className="cos-mono" style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #1b2b42' }}>
              <th style={{ padding: 6 }}>On</th>
              <th style={{ padding: 6 }}>Phrase</th>
              <th style={{ padding: 6 }}>Mode</th>
              <th style={{ padding: 6 }}>Cat</th>
              <th style={{ padding: 6 }}>Risk</th>
              <th style={{ padding: 6 }}>Confirm</th>
              <th style={{ padding: 6 }}>Action</th>
              <th style={{ padding: 6 }}>Intent</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #142236' }}>
                <td style={{ padding: 4 }}>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={async (e) => {
                      await CommandEncyclopediaService.setEnabled(r.id, e.target.checked)
                      void load()
                    }}
                  />
                </td>
                <td style={{ padding: 4 }}>{r.phrase}</td>
                <td style={{ padding: 4 }}>{r.mode}</td>
                <td style={{ padding: 4 }}>{r.category}</td>
                <td style={{ padding: 4 }}>{r.riskLevel}</td>
                <td style={{ padding: 4 }}>{r.requiresConfirmation ? 'yes' : '—'}</td>
                <td style={{ padding: 4, maxWidth: 200, wordBreak: 'break-word' }}>{commandActionPreview(r.action)}</td>
                <td style={{ padding: 4, maxWidth: 180 }}>{r.intent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
