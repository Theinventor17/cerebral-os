import { useEffect, useState } from 'react'
import { rowToSession } from '../services/mappers'

export function AgentSessionHistory() {
  const [rows, setRows] = useState<ReturnType<typeof rowToSession>[]>([])

  useEffect(() => {
    void (async () => {
      const raw = (await window.ra.session.list()) as Array<Record<string, unknown>>
      setRows(raw.map(rowToSession))
    })()
  }, [])

  return (
    <div className="ra-screen" style={{ padding: 16 }}>
      <h1 className="ra-h1">Session history</h1>
      <table className="ra-tbl">
        <thead>
          <tr>
            <th>Title</th>
            <th>Started</th>
            <th>Mode</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td>{r.startedAt}</td>
              <td>{r.mode}</td>
              <td>{r.summary ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
