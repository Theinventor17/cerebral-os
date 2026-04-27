import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useResonantAgents } from '../../providers/ResonantAgentsProvider'
import type { AgentMemoryEntry } from '../../types'

type RTab = 'guide' | 'memory' | 'tools' | 'context'

function memoryLabel(t: AgentMemoryEntry['memoryType']): string {
  switch (t) {
    case 'conversation':
      return 'Conversation'
    case 'goal_set':
      return 'Goal Set'
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

export function IDERightInspector(): ReactNode {
  const [tab, setTab] = useState<RTab>('guide')
  const {
    activeAgent,
    memory,
    demoMode,
    localOnly,
    completeGuide,
    sessionId,
    headsetLive,
    signalLock,
    eegLine,
    sessionMode
  } = useResonantAgents()

  return (
    <aside className="cide-right" aria-label="Inspector">
      <div className="cide-r-tabs" role="tablist">
        <button type="button" className={tab === 'guide' ? 'cide-r-on' : ''} onClick={() => setTab('guide')}>
          Guide
        </button>
        <button type="button" className={tab === 'memory' ? 'cide-r-on' : ''} onClick={() => setTab('memory')}>
          Memory
        </button>
        <button type="button" className={tab === 'tools' ? 'cide-r-on' : ''} onClick={() => setTab('tools')}>
          Tools
        </button>
        <button type="button" className={tab === 'context' ? 'cide-r-on' : ''} onClick={() => setTab('context')}>
          Context
        </button>
      </div>
      <div className="cide-r-body">
        {tab === 'guide' && <GuideTab localOnly={localOnly} demoMode={demoMode} completeGuide={completeGuide} />}
        {tab === 'memory' && (
          <MemoryTab memory={memory} activeAgent={activeAgent} demoMode={demoMode} />
        )}
        {tab === 'tools' && <ToolsTab activeAgent={activeAgent} />}
        {tab === 'context' && (
          <ContextTab
            sessionId={sessionId}
            sessionMode={sessionMode}
            headsetLive={headsetLive}
            signalLock={signalLock}
            eegLine={eegLine}
          />
        )}
      </div>
    </aside>
  )
}

function GuideTab({
  localOnly,
  demoMode,
  completeGuide
}: {
  localOnly: boolean
  demoMode: boolean
  completeGuide: ReturnType<typeof useResonantAgents>['completeGuide']
}) {
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
    <>
      <h4>Agent guide</h4>
      {localOnly && <p className="cide-b-empty">Local-only: cloud guide may be limited in main process.</p>}
      {demoMode && lines.length === 0 && !err && (
        <p className="cide-b-empty">Demo mode on — guide still uses your configured provider when you send.</p>
      )}
      {lines.map((l, i) => (
        <div key={i} className={l.role === 'assistant' ? 'ra-bub ra-bub-a' : 'ra-bub ra-bub-u'} style={{ fontSize: 11 }}>
          {l.role === 'user' && <span className="ra-bub-t">You</span>}
          {l.content}
        </div>
      ))}
      {err && <p className="cide-err">{err}</p>}
      <div className="cide-r-input-row">
        <input
          value={g}
          onChange={(e) => setG(e.target.value)}
          placeholder="Ask the guide…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void send()
            }
          }}
          disabled={busy}
        />
        <button type="button" className="cide-btn" disabled={busy} onClick={() => void send()}>
          Send
        </button>
      </div>
    </>
  )
}

function MemoryTab({
  memory,
  activeAgent,
  demoMode
}: {
  memory: AgentMemoryEntry[]
  activeAgent: ReturnType<typeof useResonantAgents>['activeAgent']
  demoMode: boolean
}) {
  const list = useMemo(
    () => memory.filter((m) => !activeAgent || m.agentId === activeAgent.id).slice(0, 8),
    [memory, activeAgent]
  )
  if (list.length === 0) {
    return <p className="cide-b-empty">{demoMode ? 'No API memory yet. Demo data may appear in full Memory tab.' : 'No memory for this agent.'}</p>
  }
  return (
    <>
      {list.map((m) => (
        <div key={m.id} className="cide-r-mem">
          <p style={{ fontSize: 9, textTransform: 'uppercase', color: '#5c6a7d', margin: 0 }}>{memoryLabel(m.memoryType)}</p>
          <strong>{m.title}</strong>
          <p style={{ fontSize: 10, margin: '4px 0 0 0' }}>{m.body}</p>
        </div>
      ))}
    </>
  )
}

function ToolsTab({ activeAgent }: { activeAgent: ReturnType<typeof useResonantAgents>['activeAgent'] }) {
  if (!activeAgent) {
    return <p className="cide-b-empty">No agent selected.</p>
  }
  const tools = activeAgent.toolsEnabled?.length ? activeAgent.toolsEnabled : ['(none)']
  return (
    <>
      <h4>Permissions</h4>
      <p style={{ fontSize: 10 }}>
        {activeAgent.permissions?.map((p) => `${p.scope}: ${p.mode}`).join(' · ') || '—'}
      </p>
      <h4>Model</h4>
      <pre style={{ fontSize: 10 }}>{activeAgent.modelName}</pre>
      <h4>Tools</h4>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10 }}>
        {tools.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </>
  )
}

function ContextTab({
  sessionId,
  sessionMode,
  headsetLive,
  signalLock,
  eegLine
}: {
  sessionId: string | null
  sessionMode: string
  headsetLive: boolean
  signalLock: number | null
  eegLine: string
}) {
  const sig = signalLock == null ? '—' : `${Math.min(100, Math.round(signalLock <= 1 ? signalLock * 100 : signalLock))}%`
  return (
    <>
      <h4>Session</h4>
      <p style={{ fontSize: 10, fontFamily: 'var(--cide-mono, monospace)' }}>{sessionId ?? '—'}</p>
      <h4>Mode</h4>
      <p style={{ fontSize: 10 }}>{sessionMode}</p>
      <h4>Headset</h4>
      <p style={{ fontSize: 10 }}>{headsetLive ? 'Live' : 'Not connected'}</p>
      <h4>Signal lock</h4>
      <p style={{ fontSize: 10 }}>{sig}</p>
      <h4>EEG</h4>
      <p style={{ fontSize: 10 }}>{eegLine}</p>
    </>
  )
}
