import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RAAvatar } from '../RAIcons'
import { ConversationListRow } from '../ConversationListRow'
import { useResonantAgents } from '../../providers/ResonantAgentsProvider'
import { formatSessionListTime } from '../../services/sessionTitle'
import type { AgentSession, ResonantAgent } from '../../types'

const AGENT_ORDER = ['forge', 'harmony', 'lumen', 'nexus', 'oracle', 'sage', 'sentinel']

function sortAgents(agents: ResonantAgent[]): ResonantAgent[] {
  const rank = (n: string) => {
    const i = AGENT_ORDER.indexOf(n.toLowerCase())
    return i === -1 ? 99 : i
  }
  return [...agents].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}

type ProvRow = { id: string; name: string; type: string }

export function IDEExplorerPanel(): ReactNode {
  const navigate = useNavigate()
  const {
    agents,
    activeAgent,
    setActiveAgentId,
    sessionId,
    conversations,
    startSession,
    openConversation,
    renameConversation,
    refreshConversations
  } = useResonantAgents()
  const [q, setQ] = useState('')
  const [provs, setProvs] = useState<ProvRow[]>([])

  useEffect(() => {
    let ok = true
    void (async () => {
      const raw = (await window.ra.provider.list()) as Array<Record<string, unknown>>
      if (!ok) {
        return
      }
      setProvs(
        raw.map((p) => ({
          id: String(p.id),
          name: String(p.name ?? p.id),
          type: String(p.type)
        }))
      )
    })()
    return () => {
      ok = false
    }
  }, [])

  useEffect(() => {
    void refreshConversations()
  }, [refreshConversations, agents, activeAgent?.id])

  const filtered = useMemo(() => {
    const s = sortAgents(agents)
    const t = q.trim().toLowerCase()
    if (!t) {
      return s
    }
    return s.filter((a) => a.name.toLowerCase().includes(t) || a.role.toLowerCase().includes(t))
  }, [agents, q])

  const openAgent = useCallback(
    (id: string) => {
      setActiveAgentId(id)
      void navigate('/app')
    },
    [setActiveAgentId, navigate]
  )

  const onNewChat = useCallback(async () => {
    const id = await startSession()
    if (id) {
      void navigate('/app')
    }
  }, [startSession, navigate])

  const onPickConversation = useCallback(
    async (c: AgentSession) => {
      await openConversation(c.id)
      void navigate('/app')
    },
    [openConversation, navigate]
  )

  return (
    <aside className="cide-explorer" aria-label="Explorer">
      <div className="cide-xp-h">Workspace</div>
      <div className="cide-xp-search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents…" aria-label="Search agents" />
      </div>
      <div className="cide-xp-new" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="cide-btn cide-btn-pri" disabled={!activeAgent} onClick={() => void onNewChat()}>
          + New chat
        </button>
        <button type="button" className="cide-xp-item" onClick={() => void navigate('/app/my-agents')} style={{ fontSize: 11 }}>
          + Create agent
        </button>
      </div>
      <div className="cide-xp-scroll">
        <div className="cide-xp-section">
          <div className="cide-xp-slabel">Conversations</div>
          {conversations.length === 0 && <p className="cide-b-empty" style={{ padding: '4px 8px' }}>No conversations yet.</p>}
          {conversations.map((c) => {
            const isCurrent = c.id === sessionId
            return (
              <ConversationListRow
                key={c.id}
                c={c}
                isCurrent={isCurrent}
                onSelect={() => void onPickConversation(c)}
                onRename={renameConversation}
                className={`cide-xp-item ${isCurrent ? 'cide-xp-sel' : ''}`.trim()}
                timeLabel={formatSessionListTime(c.startedAt)}
                variant="cide"
                stacked
              />
            )
          })}
        </div>
        <div className="cide-xp-section">
          <div className="cide-xp-slabel">Active agents</div>
          {filtered.length === 0 && <p className="cide-b-empty" style={{ padding: '4px 8px' }}>No matches.</p>}
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`cide-xp-item ${activeAgent?.id === a.id ? 'cide-xp-sel' : ''}`.trim()}
              onClick={() => openAgent(a.id)}
            >
              <span style={{ flex: 'none' }} aria-hidden>
                <RAAvatar agent={a} size={18} />
              </span>
              <span className="cide-xp-nowrap">{a.name}</span>
            </button>
          ))}
        </div>
        <div className="cide-xp-section">
          <div className="cide-xp-slabel">Swarms</div>
          <button type="button" className="cide-xp-item" onClick={() => void navigate('/app/swarm')}>
            <span>⬡</span>
            <span>Build pipeline</span>
            <small>orchestration</small>
          </button>
        </div>
        <div className="cide-xp-section">
          <div className="cide-xp-slabel">Providers</div>
          {provs.length === 0 && <p className="cide-b-empty" style={{ padding: '4px 8px' }}>Loading…</p>}
          {provs.map((p) => (
            <button key={p.id} type="button" className="cide-xp-item" onClick={() => void navigate('/app/providers')}>
              <span>◫</span>
              <span className="cide-xp-nowrap">{p.name}</span>
              <small>{p.type}</small>
            </button>
          ))}
        </div>
        <div className="cide-xp-section">
          <div className="cide-xp-slabel">Local models</div>
          <button type="button" className="cide-xp-item" onClick={() => void navigate('/app/local-models')}>
            <span>⬚</span>
            <span>GGUF / Ollama / LM Studio</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
