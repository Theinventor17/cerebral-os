import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useResonantAgents, CMDS } from '../providers/ResonantAgentsProvider'
import { RAAvatar } from '../components/RAIcons'
import { RAPermissionGateModal } from '../components/RAPermissionGateModal'
import type { AgentMemoryEntry, AgentMessage, ResonantAgent, SessionMode } from '../types'

const suggestions = [
  'Decompose my tasks',
  'Reduce stress',
  'Prioritize goals',
  'Mindfulness exercise',
  'Get perspective'
]

const cmdLabels: Record<string, string> = {
  focus_agent: 'Focus Agent',
  send_message: 'Send Message',
  ask_question: 'Ask Question',
  request_output: 'Request Output',
  switch_agent: 'Switch Agent',
  confirm_intent: 'Confirm Intent',
  reject_intent: 'Reject Intent',
  end_link: 'End link'
}

const AGENT_ORDER = [
  'forge',
  'harmony',
  'lumen',
  'nexus',
  'oracle',
  'sage',
  'sentinel'
]

function sortAgents(agents: ResonantAgent[]): ResonantAgent[] {
  const rank = (n: string) => {
    const i = AGENT_ORDER.indexOf(n.toLowerCase())
    return i === -1 ? 99 : i
  }
  return [...agents].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}

const DEMO_FORGE_CHAT: AgentMessage[] = [
  {
    id: 'demo-f-1',
    sessionId: 'demo',
    role: 'assistant',
    inputSource: 'manual',
    content: 'I can help you build, automate, and engineer. What are we building today?',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-f-2',
    sessionId: 'demo',
    role: 'user',
    inputSource: 'thought',
    content: 'Create a script that organizes my project files by type and date.',
    createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-f-3',
    sessionId: 'demo',
    role: 'assistant',
    inputSource: 'manual',
    content:
      "I'll create a Python script that scans your project directory, sorts files by type, and organizes them into dated folders with a clean structure.",
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  }
]

type GuideLine = { role: 'user' | 'assistant'; content: string }

const DEFAULT_MEMORY: AgentMemoryEntry[] = [
  {
    id: 'mem-d-1',
    agentId: '',
    memoryType: 'conversation',
    title: 'Conversation',
    body: 'Project architecture discussion with Forge',
    createdAt: '2026-04-25T10:26:00.000Z'
  },
  {
    id: 'mem-d-2',
    agentId: '',
    memoryType: 'goal_set',
    title: 'Goal Set',
    body: 'Automate file organization & backups',
    createdAt: '2026-04-25T10:24:00.000Z'
  },
  {
    id: 'mem-d-3',
    agentId: '',
    memoryType: 'note',
    title: 'Code Output',
    body: 'File organizer script (Python)',
    createdAt: '2026-04-25T10:22:00.000Z'
  },
  {
    id: 'mem-d-4',
    agentId: '',
    memoryType: 'insight',
    title: 'Insight',
    body: 'Automation improves focus & reduces cognitive load',
    createdAt: '2026-04-25T10:20:00.000Z'
  },
  {
    id: 'mem-d-5',
    agentId: '',
    memoryType: 'conversation',
    title: 'Conversation',
    body: 'Debugging environment setup',
    createdAt: '2026-04-25T10:18:00.000Z'
  }
]

function formatMsgTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

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
      return 'Code Output'
    default:
      return String(t)
  }
}

function TopBar({ agent }: { agent: ResonantAgent | null }) {
  const { sessionMode, setSessionMode, signalLock, cortex, eegLine, headsetLive } = useResonantAgents()
  const sigLabel = signalLock == null ? '—' : `${Math.min(100, Math.round((signalLock <= 1 ? signalLock * 100 : signalLock)))}%`
  const barPct = signalLock == null ? 0 : Math.min(100, Math.round((signalLock <= 1 ? signalLock * 100 : signalLock)))

  const cycleMode = useCallback(() => {
    const order: SessionMode[] = ['manual', 'hybrid', 'thought']
    const i = order.indexOf(sessionMode)
    const n = i < 0 ? 0 : (i + 1) % order.length
    void setSessionMode(order[n])
  }, [sessionMode, setSessionMode])

  if (!agent) {
    return (
      <div className="ra-topbar">
        <div className="ra-card" style={{ gridColumn: '1 / -1' }}>
          <span className="ra-lbl">Loading agents…</span>
        </div>
      </div>
    )
  }
  return (
    <div className="ra-topbar">
      <div className="ra-card ra-card--agent" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <RAAvatar agent={agent} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ra-lbl">Active agent</div>
          <h2 className="ra-card-title" style={{ fontSize: 13, textTransform: 'none', letterSpacing: 0, fontWeight: 800 }}>
            {agent.name}
          </h2>
          <p className="ra-mute" style={{ fontSize: 10, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agent.role}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="ra-card"
        onClick={cycleMode}
        style={{ cursor: 'pointer', textAlign: 'left', background: 'inherit', color: 'inherit', border: '1px solid rgba(155,92,255,0.25)' }}
        title="Click to cycle Manual → Hybrid → Thought (Thought requires a headset)"
      >
        <div className="ra-lbl">Mode</div>
        <h2 className="ra-txt-grad" style={{ fontSize: 13, textTransform: 'uppercase', margin: 0 }}>
          {sessionMode === 'thought' ? 'THOUGHT' : sessionMode === 'hybrid' ? 'HYBRID' : 'MANUAL'}
        </h2>
        <p className="ra-mute" style={{ fontSize: 9, margin: '4px 0 0 0' }}>
          Click to change
        </p>
      </button>
      <div className="ra-card ra-card--signal">
        <div className="ra-lbl">Signal lock</div>
        <div className="ra-signal-row">
          <span className="ra-signal-pct--compact">{sigLabel}</span>
          <div className="ra-signal-wf" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <b key={i} />
            ))}
          </div>
        </div>
        <div className="ra-signal-bar">
          <span style={{ width: `${barPct}%` }} />
        </div>
      </div>
      <div className="ra-card">
        <div className="ra-lbl">Neural link</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2 className={cortex.ok && headsetLive ? 'ra-conn' : 'ra-disconn'} style={{ textTransform: 'uppercase', margin: 0, fontSize: 11 }}>
            {cortex.ok && headsetLive ? 'CONNECTED' : 'OFFLINE'}
          </h2>
          <div className="ra-pulse" aria-hidden style={{ height: 18 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <b key={i} />
            ))}
          </div>
        </div>
        <p className="ra-mute" style={{ fontSize: 9, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {eegLine}
        </p>
      </div>
      <div className="ra-card ra-card--info">
        <div className="ra-lbl">Provider policy</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div className="ra-info-shield" aria-hidden>
            ⛨
          </div>
          <p className="ra-mute" style={{ margin: 0, fontSize: 10, lineHeight: 1.35 }}>
            Sessions use your selected provider. Cloud calls respect local-only policy.
          </p>
        </div>
      </div>
    </div>
  )
}

function MyAgentsPanel() {
  const { agents, activeAgent, setActiveAgentId } = useResonantAgents()
  const sorted = useMemo(() => sortAgents(agents), [agents])
  return (
    <div className="ra-panel">
      <div className="ra-panel-h">
        <h3>My agents</h3>
        <button type="button" className="ra-btn ra-btn-sm">
          + Add agent
        </button>
      </div>
      <div className="ra-list-scroll">
        {sorted.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`ra-agent-tile ${activeAgent?.id === a.id ? 'ra-tile-on' : ''}`}
            onClick={() => setActiveAgentId(a.id)}
          >
            <RAAvatar agent={a} size={48} />
            <div>
              <p className="ra-name">{a.name}</p>
              <p className="ra-role">{a.role}</p>
              <div className="ra-stat">
                <span className={`ra-dot${a.status === 'busy' ? ' busy' : ''}${a.status === 'error' ? ' error' : ''}`} />
                {a.status === 'error' ? 'Error' : a.status === 'busy' ? 'Busy' : a.status === 'offline' ? 'Offline' : 'Online'}
              </div>
            </div>
          </button>
        ))}
      </div>
      <button type="button" className="ra-btn ra-btn-ghost" style={{ marginTop: 8 }}>
        Browse marketplace
      </button>
    </div>
  )
}

function ChannelPanel() {
  const {
    activeAgent,
    messages,
    sendMessage,
    sending,
    sendError,
    sessionMode,
    endSession,
    demoMode,
    headsetLive
  } = useResonantAgents()
  const [tab, setTab] = useState<'chat' | 'insights' | 'memory' | 'goals'>('chat')
  const [input, setInput] = useState('')

  const displayMessages = useMemo(() => {
    if (messages.length > 0) {
      return messages
    }
    if (demoMode && activeAgent && activeAgent.name.toLowerCase().includes('forge')) {
      return DEMO_FORGE_CHAT
    }
    return []
  }, [messages, activeAgent, demoMode])

  const thoughtBlocked = sessionMode === 'thought' && !headsetLive

  if (!activeAgent) {
    return <div className="ra-panel">Select an agent.</div>
  }

  return (
    <div className="ra-channel">
      <div className="ra-ch-head">
        <RAAvatar agent={activeAgent} size={82} className="ra-ch-av" />
        <div style={{ minWidth: 0 }}>
          <h2 className="ra-name" style={{ fontSize: 18, margin: '0 0 2px 0' }}>
            {activeAgent.name}
          </h2>
          <p className="ra-role">{activeAgent.role}</p>
          <p className="ra-mute" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.35 }}>
            {activeAgent.description}
          </p>
        </div>
        <button type="button" className="ra-end-btn" onClick={() => void endSession()}>
          End session
        </button>
      </div>
      <div className="ra-ch-tabs">
        {(['chat', 'insights', 'memory', 'goals'] as const).map((t) => (
          <button key={t} type="button" className={tab === t ? 'ra-on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="ra-chat">
        {tab === 'chat' &&
          displayMessages.map((m) => {
            const isUser = m.role !== 'assistant'
            const wrap = (
              <div key={m.id} className={`ra-bub-wrap ${isUser ? 'ra-bub--right' : ''}`}>
                <div className="ra-bub-h">
                  <span className={`ra-bub-av ${isUser ? 'ra-bub-av--user' : ''}`} aria-hidden />
                  <span className="ra-bub-time">{formatMsgTime(m.createdAt)}</span>
                </div>
                {isUser ? (
                  <div className="ra-bub ra-bub-u">
                    {m.inputSource === 'thought' && <span className="ra-bub-t">You (via thought)</span>}
                    {m.content}
                  </div>
                ) : (
                  <div className="ra-bub ra-bub-a">{m.content}</div>
                )}
              </div>
            )
            return wrap
          })}
        {tab === 'chat' && displayMessages.length === 0 && (
          <p className="ra-mute" style={{ padding: 8 }}>
            {demoMode
              ? 'Send a message to start the channel. Demo Mode can show a sample Forge transcript when Forge is selected.'
              : 'Send a message to start. Chat works without a headset in Manual or Hybrid mode.'}
          </p>
        )}
        {thoughtBlocked && (
          <p className="ra-err" style={{ padding: 8 }}>
            Thought mode requires a connected headset. Switch to Manual or Hybrid to type.
          </p>
        )}
        {tab !== 'chat' && <div className="ra-mute">Insights / memory / goals views are placeholders for this module.</div>}
        {sendError && <div className="ra-err">{sendError}</div>}
      </div>
      <div className="ra-near">
        <div className="ra-near-txt">
          <h4>LISTENING TO NEURAL PATTERNS…</h4>
          <p>Detecting intent, emotion, and focus state</p>
        </div>
        <button type="button" className="ra-btn ra-choose">
          Choose intent
        </button>
        <div className="ra-near-wf" aria-hidden>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <b key={i} />
          ))}
        </div>
      </div>
      <div className="ra-suggest">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => setInput(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="ra-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            thoughtBlocked
              ? 'Switch to Manual or Hybrid to type…'
              : sessionMode === 'thought'
                ? 'Type with headset signal…'
                : 'Type a message…'
          }
          disabled={thoughtBlocked}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !thoughtBlocked) {
              void sendMessage(input, 'manual')
              setInput('')
            }
          }}
        />
        <button
          type="button"
          className="ra-btn ra-btn--gradient"
          disabled={sending || thoughtBlocked}
          onClick={() => {
            void sendMessage(input, 'manual')
            setInput('')
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

const MEM_ICO: Record<AgentMemoryEntry['memoryType'], string> = {
  conversation: '💬',
  goal_set: '◆',
  image_output: '▣',
  insight: '◈',
  note: '⬡'
}

function MemoryPanel() {
  const { memory, activeAgent, demoMode } = useResonantAgents()
  const fromApi = useMemo(
    () => memory.filter((m) => !activeAgent || m.agentId === activeAgent.id).slice(0, 6),
    [memory, activeAgent]
  )
  const list: AgentMemoryEntry[] = fromApi.length > 0 ? fromApi : demoMode ? DEFAULT_MEMORY : []
  return (
    <div className="ra-panel">
      <div className="ra-panel-h">
        <h3>Agent memory</h3>
        <span className="ra-mute" style={{ fontSize: 12 }}>
          ⛶
        </span>
      </div>
      <div className="ra-list-scroll">
        {list.length === 0 && (
          <p className="ra-mute" style={{ padding: 8 }}>
            No memory saved yet.
          </p>
        )}
        {list.map((m) => (
          <div key={m.id} className="ra-mem-item">
            <div className="ra-mem-ico" aria-hidden>
              {MEM_ICO[m.memoryType] ?? '◇'}
            </div>
            <div className="ra-mem-body">
              <p className="ra-mem-type">{memoryLabel(m.memoryType)}</p>
              <h4>{m.title}</h4>
              <p>{m.body}</p>
              <div className="ra-mem-time">
                <span className="ra-mem-dot" />
                {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="ra-btn ra-btn-ghost" style={{ marginTop: 8 }}>
        View all memory
      </button>
    </div>
  )
}

function GuidePanel() {
  const { completeGuide, localOnly, demoMode } = useResonantAgents()
  const [g, setG] = useState('')
  const [lines, setLines] = useState<GuideLine[]>([])
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
    const hist: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = lines.map((l) => ({
      role: l.role,
      content: l.content
    }))
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
    <div className="ra-panel">
      <div className="ra-panel-h">
        <h3>Agent guide</h3>
        {localOnly && <span className="ra-mute" style={{ fontSize: 11 }}>Local-only mode (cloud guide disabled in main process)</span>}
      </div>
      {demoMode && lines.length === 0 && !err && (
        <p className="ra-mute" style={{ fontSize: 10, marginTop: 0 }}>Demo Mode also shows static samples elsewhere — guide uses your configured provider when you send.</p>
      )}
      <div className="ra-guide">
        <div className="ra-guide-scroll">
          {lines.length === 0 && !err && (
            <p className="ra-mute" style={{ fontSize: 12 }}>
              Ask how to use agents, modes, and providers. Responses use your default or Guide provider in settings.
            </p>
          )}
          {lines.map((l, i) => (
            <div key={i} className={l.role === 'assistant' ? 'ra-bub ra-bub-a' : 'ra-bub ra-bub-u'}>
              {l.role === 'user' && <span className="ra-bub-t">You</span>}
              {l.content}
            </div>
          ))}
          {err && <div className="ra-err" style={{ marginTop: 8 }}>{err}</div>}
        </div>
        <div className="ra-guide-inp">
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
          <button type="button" className="ra-btn ra-btn-sm" disabled={busy} onClick={() => void send()}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

function MiniWf() {
  return (
    <div className="ra-cmd-wf" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <i key={i} />
      ))}
    </div>
  )
}

function ThoughtStrip() {
  const { thoughtStatuses, headsetLive } = useResonantAgents()
  return (
    <div className="ra-commands" aria-label="Thought commands detected">
      {CMDS.map((c) => {
        const st = thoughtStatuses[c]
        const statusClass =
          st === 'rejected' ? 'ra-cmd-rejected' : st === 'confirmed' ? 'ra-cmd-confirmed' : st === 'detected' ? 'ra-cmd-detected' : ''
        const stLabel = !headsetLive
          ? 'No signal'
          : st === 'idle'
            ? 'Idle'
            : st.charAt(0).toUpperCase() + st.slice(1)
        return (
          <div key={c} className={`ra-cmd ${statusClass}`.trim()}>
            <div className="ra-cmd-h">
              <span className="ra-cmd-ico">◇</span>
              <div className="ra-cmd-title">{cmdLabels[c]}</div>
            </div>
            <span className="ra-cmd-st">{stLabel}</span>
            <MiniWf />
          </div>
        )
      })}
    </div>
  )
}

function BottomBar() {
  const {
    timeLabel,
    headset,
    battery,
    ollamaLabel,
    lmStudioUp,
    openRouterEnabled,
    cortex,
    autoListen,
    setAutoListen,
    localOnly,
    sessionMode
  } = useResonantAgents()
  const cortexState = cortex.ok ? 'OK' : 'Unavailable'
  return (
    <div className="ra-telemetry" role="status" aria-label="Session telemetry">
      <div className="ra-tm">
        <span className="ra-tm-ico" aria-hidden>
          ◷
        </span>
        <div className="ra-tm-lbl">Session timer</div>
        <div className="ra-tm-val">
          <span className="ra-mono">{timeLabel}</span>
        </div>
      </div>
      <div className="ra-tm">
        <span className="ra-tm-ico" aria-hidden>
          ⎔
        </span>
        <div className="ra-tm-lbl">Headset</div>
        <div className="ra-tm-val">{headset}</div>
      </div>
      <div className="ra-tm">
        <span className="ra-tm-ico" aria-hidden>
          ▮
        </span>
        <div className="ra-tm-lbl">Battery</div>
        <div className="ra-tm-val">
          <span className="ra-good">{battery}</span>
        </div>
      </div>
      <div className="ra-tm">
        <span className="ra-tm-ico" aria-hidden>
          ⧉
        </span>
        <div className="ra-tm-lbl">Local LLM</div>
        <div className="ra-tm-val" title={ollamaLabel} style={{ flexWrap: 'wrap' }}>
          <span className={ollamaLabel.toLowerCase().includes('offline') ? 'ra-bad' : 'ra-good'}>
            {ollamaLabel.toLowerCase().includes('offline') ? 'Offline' : 'Online'}
          </span>
          <span className="ra-mute" style={{ fontSize: 11, fontWeight: 500, marginLeft: 6, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ollamaLabel}
          </span>
        </div>
      </div>
      <div className="ra-tm">
        <span className="ra-tm-ico" aria-hidden>
          ◫
        </span>
        <div className="ra-tm-lbl">LM Studio</div>
        <div className="ra-tm-val">
          <span className="ra-mute" style={{ fontSize: 11, marginRight: 4 }}>
            localhost:1234
          </span>
          {lmStudioUp == null ? (
            <span className="ra-mute">n/a</span>
          ) : (
            <>
              <span className={`ra-tm-dot ${lmStudioUp ? 'ra-ok' : 'ra-off'}`} />
              <span className={lmStudioUp ? 'ra-good' : 'ra-bad'}>{lmStudioUp ? 'OK' : 'down'}</span>
            </>
          )}
        </div>
      </div>
      <div className="ra-tm">
        <span className="ra-tm-ico" aria-hidden>
          ✦
        </span>
        <div className="ra-tm-lbl">OpenRouter</div>
        <div className="ra-tm-val">
          <span className={`ra-tm-dot ${openRouterEnabled ? 'ra-ok' : 'ra-off'}`} />
          <span className={openRouterEnabled ? 'ra-good' : 'ra-mute'}>{openRouterEnabled ? 'Enabled' : 'Off'}</span>
        </div>
      </div>
      <div className="ra-tm">
        <span className="ra-tm-ico" aria-hidden>
         ◎
        </span>
        <div className="ra-tm-lbl">EMOTIV Cortex</div>
        <div className="ra-tm-val">
          <span className={`ra-tm-dot ${cortex.ok ? 'ra-ok' : 'ra-off'}`} />
          <span className={cortex.ok ? 'ra-good' : 'ra-bad'}>{cortexState}</span>
        </div>
      </div>
      <div className="ra-tm">
        <span className="ra-tm-ico" aria-hidden>
          ⎆
        </span>
        <div className="ra-tm-lbl">Mode</div>
        <div className="ra-tm-val" style={{ fontSize: 11 }}>
          {sessionMode === 'thought' ? 'Thought' : sessionMode === 'hybrid' ? 'Hybrid' : 'Manual'}
        </div>
      </div>
      {localOnly && (
        <div className="ra-tm" style={{ flex: '1 1 200px' }}>
          <div className="ra-tm-lbl">Policy</div>
          <div className="ra-tm-val">
            <span className="ra-bad">Local-only on</span>
            <span className="ra-mute" style={{ fontSize: 10, marginLeft: 6 }}>
              Cloud models disabled
            </span>
          </div>
        </div>
      )}
      <div className="ra-tm" style={{ flex: '0 0 100px' }}>
        <span className="ra-tm-ico" aria-hidden>
          ♪
        </span>
        <div className="ra-tm-lbl">Auto-listen</div>
        <div className="ra-tm-val">
          <button
            type="button"
            className={`ra-tm-btn ${autoListen ? 'ra-tm-on' : ''}`}
            onClick={() => void setAutoListen(!autoListen)}
          >
            {autoListen ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ResonantAgentsDashboard(): ReactNode {
  const { activeAgent, endSession, openShellGate } = useResonantAgents()
  return (
    <div className="ra-app ra-sublayout">
      <RAPermissionGateModal />
      <div className="ra-main" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <TopBar agent={activeAgent} />
        <div className="ra-content" style={{ minHeight: 0 }}>
          <MyAgentsPanel />
          <ChannelPanel />
          <MemoryPanel />
          <GuidePanel />
        </div>
        <div className="ra-thought-sect">
          <div className="ra-thought-h">
            <p className="ra-lbl" style={{ margin: 0 }}>
              THOUGHT COMMANDS (DETECTED)
            </p>
            <div className="ra-thought-h-actions">
              <button type="button" className="ra-dashed-link" onClick={openShellGate}>
                Test permission gate
              </button>
              <button type="button" className="ra-dashed-link" onClick={() => void endSession()}>
                End session
              </button>
            </div>
          </div>
          <ThoughtStrip />
        </div>
        <BottomBar />
      </div>
    </div>
  )
}
