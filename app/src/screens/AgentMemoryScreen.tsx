import { useEffect, useState } from 'react'
import { AgentMemoryService } from '../services/AgentMemoryService'
import { rowToAgent } from '../services/mappers'
import type { ResonantAgent } from '../types'

export function AgentMemoryScreen() {
  const [q, setQ] = useState('')
  const [agentId, setAgentId] = useState<string | 'all'>('all')
  const [agents, setAgents] = useState<ResonantAgent[]>([])
  const [rows, setRows] = useState<Awaited<ReturnType<typeof AgentMemoryService.list>>>([])

  useEffect(() => {
    void (async () => {
      const arows = (await window.ra.agent.list()) as Array<Record<string, unknown>>
      setAgents(arows.map(rowToAgent))
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      const m = await AgentMemoryService.list(agentId === 'all' ? undefined : agentId)
      setRows(
        m.filter(
          (r) =>
            !q ||
            r.title.toLowerCase().includes(q.toLowerCase()) ||
            r.body.toLowerCase().includes(q.toLowerCase())
        )
      )
    })()
  }, [agentId, q])

  return (
    <div className="ra-screen" style={{ padding: 16 }}>
      <h1 className="ra-h1">Memory</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="ra-mono" style={{ flex: 1, minWidth: 200, background: '#0b1422', border: '1px solid #1b2b42', color: '#f4f8ff', borderRadius: 6, padding: 8 }} />
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value as string | 'all')}
          style={{ background: '#0b1422', border: '1px solid #1b2b42', color: '#f4f8ff', borderRadius: 6, padding: 8 }}
        >
          <option value="all">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <table className="ra-tbl">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td>{r.memoryType}</td>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
