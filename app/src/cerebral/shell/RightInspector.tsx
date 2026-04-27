import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { RAAvatar } from '@/components/RAIcons'
import { EegBrainVizCanvas } from '@/cerebral/eeg/EegBrainVizCanvas'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'
import { useCerebralLayout } from '../context/CerebralTabContext'
import type { AgentMemoryEntry } from '@/types'
function memLab(t: AgentMemoryEntry['memoryType']): string {
  switch (t) {
    case 'conversation':
      return 'Conversation'
    case 'goal_set':
      return 'Goal'
    case 'image_output':
      return 'Image'
    case 'insight':
      return 'Insight'
    case 'note':
      return 'Note'
    default:
      return String(t)
  }
}

export function RightInspector(): ReactNode {
  const { rightTab, setRightTab } = useCerebralLayout()
  return (
    <aside className="cos-right" aria-label="Side inspector">
      <div className="cos-rtab" role="tablist">
        {(['agent', 'memory', 'tools', 'context', 'guide'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={rightTab === k ? 'cos-ron' : undefined}
            onClick={() => setRightTab(k)}
          >
            {k === 'agent' ? 'Agent' : k === 'memory' ? 'Memory' : k === 'tools' ? 'Tools' : k === 'context' ? 'Context' : 'Guide'}
          </button>
        ))}
      </div>
      <div className="cos-rbody">
        {rightTab === 'agent' && <AgentPane />}
        {rightTab === 'memory' && <MemoryPane />}
        {rightTab === 'tools' && <ToolsPane />}
        {rightTab === 'context' && <ContextPane />}
        {rightTab === 'guide' && <GuidePane />}
      </div>
    </aside>
  )
}

function AgentPane(): ReactNode {
  const { activeAgent } = useResonantAgents()
  if (!activeAgent) {
    return <p style={{ color: 'var(--text-muted)' }}>No active agent. Pick one in Agents or open a .chat tab.</p>
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <RAAvatar agent={activeAgent} size={36} />
        <div>
          <h4 style={{ color: '#e0ecff', margin: 0, fontSize: 12 }}>{activeAgent.name}</h4>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{activeAgent.role}</p>
        </div>
      </div>
      <h4>Model on agent</h4>
      <pre style={{ fontSize: 10 }}>{activeAgent.modelName}</pre>
    </div>
  )
}

function MemoryPane(): ReactNode {
  const { memory, activeAgent, demoMode } = useResonantAgents()
  const list = useMemo(
    () => memory.filter((m) => !activeAgent || m.agentId === activeAgent.id).slice(0, 12),
    [memory, activeAgent]
  )
  if (list.length === 0) {
    return <p className="cos-mono">{demoMode ? 'No API memory; demo data may appear in Memory screen.' : 'No memory for this agent.'}</p>
  }
  return (
    <>
      {list.map((m) => (
        <div key={m.id} style={{ borderBottom: '1px solid #142236', padding: '6px 0' }}>
          <div style={{ fontSize: 9, color: '#5c6a7d' }}>{memLab(m.memoryType)}</div>
          <div style={{ fontSize: 11, color: '#d8e4f5' }}>{m.title}</div>
          <div style={{ fontSize: 10, color: '#9fadc2' }}>{m.body.slice(0, 200)}</div>
        </div>
      ))}
    </>
  )
}

function ToolsPane(): ReactNode {
  const { activeAgent } = useResonantAgents()
  if (!activeAgent) {
    return <p className="cos-mono">—</p>
  }
  return (
    <div>
      <h4>Tool scopes (permissions)</h4>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10 }}>
        {activeAgent.permissions.map((p) => (
          <li key={p.id}>
            {p.scope}: {p.mode}
          </li>
        ))}
      </ul>
      <h4>Tools enabled (declared)</h4>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10 }}>
        {activeAgent.toolsEnabled.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

function ContextPane(): ReactNode {
  const { sessionId, sessionMode, insightLive, thoughtIntent, signalLock, eegLine, timeLabel } = useResonantAgents()
  const sig = signalLock == null ? '—' : `${Math.min(100, Math.round(signalLock <= 1 ? signalLock * 100 : signalLock))}%`
  const iq = thoughtIntent?.signalQuality
  const intentLine =
    thoughtIntent && thoughtIntent.source !== 'none'
      ? `${thoughtIntent.command ?? '—'} conf ${(thoughtIntent.confidence * 100).toFixed(0)}% src ${thoughtIntent.source} · sig ${iq == null ? '—' : (iq * 100).toFixed(0) + '%'} — ${thoughtIntent.reason}`
      : '—'
  return (
    <div>
      <EegBrainVizCanvas compact className="cos-brain-viz--compact" />
      <h4>Session</h4>
      <pre style={{ fontSize: 10 }}>{sessionId ?? '—'}</pre>
      <h4>Mode</h4>
      <p style={{ fontSize: 10 }}>{sessionMode}</p>
      <h4>Timer</h4>
      <p style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)' }}>{timeLabel}</p>
      <h4>Insight (live stream)</h4>
      <p style={{ fontSize: 10 }}>{insightLive ? 'receiving' : 'no valid frame'}</p>
      <h4>Intent (v1)</h4>
      <p style={{ fontSize: 9, lineHeight: 1.35, wordBreak: 'break-word' }}>{intentLine}</p>
      <h4>Signal lock</h4>
      <p style={{ fontSize: 10 }}>{sig} (Cortex CQ / contact when present)</p>
      <h4>EEG line</h4>
      <p style={{ fontSize: 10 }}>{eegLine}</p>
    </div>
  )
}

function GuidePane(): ReactNode {
  const { completeGuide, localOnly, demoMode } = useResonantAgents()
  const [g, setG] = useState('')
  const [lines, setLines] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const send = useCallback(async () => {
    const t = g.trim()
    if (!t) {
      return
    }
    setErr(null)
    setBusy(true)
    setG('')
    setLines((prev) => [...prev, { role: 'user', content: t }])
    const hist = lines.map((l) => ({ role: l.role, content: l.content }))
    try {
      const reply = await completeGuide(t, hist)
      setLines((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [g, completeGuide, lines])

  return (
    <div>
      {localOnly && <p className="cos-mono" style={{ fontSize: 10 }}>Local-only: cloud guide may be limited.</p>}
      {demoMode && <p className="cos-mono" style={{ fontSize: 10 }}>Demo off uses real guide provider.</p>}
      {lines.map((l, i) => (
        <p key={i} style={{ fontSize: 10, margin: '4px 0' }}>
          <strong style={{ color: l.role === 'user' ? '#6ab0ff' : '#9fadc2' }}>{l.role === 'user' ? 'You' : 'Guide'}: </strong>
          {l.content}
        </p>
      ))}
      {err && <p style={{ color: '#ff4d5e', fontSize: 10 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input
          value={g}
          onChange={(e) => setG(e.target.value)}
          placeholder="Ask the guide…"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void send()
            }
          }}
          style={{ flex: 1, minWidth: 0, height: 28, fontSize: 10, padding: '0 6px' }}
        />
        <button type="button" className="cos-send" style={{ height: 28, fontSize: 10 }} onClick={() => void send()} disabled={busy}>
          Send
        </button>
      </div>
    </div>
  )
}

