import { useEffect, useState } from 'react'
import { newId } from '../services/mappers'
import { ORCHESTRATION_MODES } from '../workflows/raWorkflows'
import type { AgentSwarm, OrchestrationMode } from '../types'
import { rowToAgent } from '../services/mappers'
import { SwarmOrchestrator } from '../services/SwarmOrchestrator'
import type { ResonantAgent } from '../types'

export function SwarmOrchestrationScreen() {
  const [agents, setAgents] = useState<ResonantAgent[]>([])
  const [name, setName] = useState('New swarm')
  const [mode, setMode] = useState<OrchestrationMode>('planner_executor')
  const [picked, setPicked] = useState<string[]>([])
  const [log, setLog] = useState('')

  useEffect(() => {
    void (async () => {
      const arows = (await window.ra.agent.list()) as Array<Record<string, unknown>>
      setAgents(arows.map(rowToAgent))
    })()
  }, [])

  const build = async () => {
    const id = newId()
    const swarm: AgentSwarm = {
      id,
      name,
      description: 'User-defined swarm (placeholder run)',
      agents: picked,
      orchestrationMode: mode,
      leaderAgentId: picked[0],
      maxTurns: 8,
      approvalRequired: true,
      createdAt: new Date().toISOString()
    }
    await window.ra.swarm.upsert({
      id: swarm.id,
      name: swarm.name,
      description: swarm.description,
      agents_json: JSON.stringify(swarm.agents),
      orchestration_mode: swarm.orchestrationMode,
      leader_agent_id: swarm.leaderAgentId ?? null,
      max_turns: swarm.maxTurns,
      approval_required: 1,
      created_at: swarm.createdAt
    } as never)
    const r = (await SwarmOrchestrator.runPlaceholder(swarm)) as { note?: string; ok?: boolean }
    setLog(r.note ?? JSON.stringify(r))
  }

  return (
    <div className="ra-screen" style={{ padding: 16 }}>
      <h1 className="ra-h1">Swarm orchestration</h1>
      <p className="ra-mute">Select agents, choose a mode, and record a placeholder run. Autonomous tool execution is not active.</p>
      <div className="ra-form" style={{ marginTop: 12 }}>
        <label>
          Swarm name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as OrchestrationMode)}>
            {ORCHESTRATION_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6f8097', fontWeight: 700 }}>Agents in swarm</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {agents.map((a) => (
            <label key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={picked.includes(a.id)}
                onChange={() =>
                  setPicked((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))
                }
              />
              {a.name}
            </label>
          ))}
        </div>
        <div className="ra-graph" style={{ width: '100%' }}>
          Node graph placeholder — {ORCHESTRATION_MODES.find((m) => m.id === mode)?.blurb}
        </div>
        <button type="button" className="ra-btn" onClick={() => void build()}>
          Save swarm + run placeholder
        </button>
        <p className="ra-mute" style={{ color: '#ffb020' }}>
          Approval required · Tool execution placeholder
        </p>
        {log && <pre className="ra-mono" style={{ background: '#0b1422', padding: 8, borderRadius: 6 }}>{log}</pre>}
      </div>
    </div>
  )
}
