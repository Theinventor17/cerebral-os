import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCatalogSkillCount, getClaudeCatalog } from '../skill/claudeCatalog'
import {
  categoriesWithCount,
  filterCatalogSkills,
  humanizeCategory,
  SKILL_KEYWORD_PRESETS
} from '../skill/skillCatalogQuery'
import {
  importCountsByWorkflow,
  importSkillForWorkflow,
  isSkillImportedForWorkflow,
  removeSkillFromWorkflow,
  WORKFLOW_SKILL_MODES
} from '../skill/workflowSkillImports'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'
import { RAAvatar } from '@/components/RAIcons'
import { CEREBRAL_HEADSETS_TAB_ID } from '../headsetsTabConstants'
import { useCerebralLayout } from '../context/CerebralTabContext'
import type { CerebralActivityId } from '../types/cerebral.ts'
import { ConversationListRow } from '@/components/ConversationListRow'
import type { AgentSession, ResonantAgent } from '@/types'
import { formatSessionListTime } from '@/services/sessionTitle'
import { ProviderSetupMap } from '../components/ProviderSetupMap'

const AGENT_ORDER = ['forge', 'harmony', 'lumen', 'nexus', 'oracle', 'sage', 'sentinel']
function sortAgents(agents: ResonantAgent[]): ResonantAgent[] {
  const rank = (n: string) => {
    const i = AGENT_ORDER.indexOf(n.toLowerCase())
    return i === -1 ? 99 : i
  }
  return [...agents].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}

const titles: Record<CerebralActivityId, string> = {
  explorer: 'Explorer',
  agents: 'Agents',
  swarms: 'Swarms',
  skills: 'Skills',
  providers: 'Providers',
  memory: 'Memory',
  headsets: 'Headsets',
  logs: 'Logs',
  settings: 'Settings'
}

export function SidePanel(): ReactNode {
  const { activity, openAgentChat, openTab, openBrowserTab, setActivity } = useCerebralLayout()
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
  const [provs, setProvs] = useState<Array<{ id: string; name: string; type: string }>>([])

  useEffect(() => {
    void (async () => {
      const raw = (await window.ra.provider.list()) as Array<Record<string, unknown>>
      setProvs(
        raw.map((p) => ({
          id: String(p.id),
          name: String(p.name ?? p.id),
          type: String(p.type)
        }))
      )
    })()
  }, [])

  useEffect(() => {
    if (activity === 'agents') {
      void refreshConversations()
    }
  }, [activity, refreshConversations])

  const filtered = useMemo(() => {
    const s = sortAgents(agents)
    const t = q.trim().toLowerCase()
    if (!t) {
      return s
    }
    return s.filter((a) => a.name.toLowerCase().includes(t) || a.role.toLowerCase().includes(t))
  }, [agents, q])

  const onPickAgent = useCallback(
    (a: ResonantAgent) => {
      setActiveAgentId(a.id)
      openAgentChat(a.id, a.name)
    },
    [setActiveAgentId, openAgentChat]
  )

  const onNewChat = useCallback(async () => {
    const id = await startSession()
    if (id && activeAgent) {
      openAgentChat(activeAgent.id, activeAgent.name)
    }
  }, [startSession, activeAgent, openAgentChat])

  const onPickConversation = useCallback(
    async (c: AgentSession) => {
      await openConversation(c.id)
      const ag = agents.find((a) => a.id === c.activeAgentId)
      if (ag) {
        openAgentChat(ag.id, ag.name)
      }
    },
    [openConversation, agents, openAgentChat]
  )

  if (activity === 'explorer') {
    return (
      <aside className="cos-side" aria-label="Explorer">
        <div className="cos-sh">Files</div>
        <div className="cos-sbody">
          <p className="cos-mono" style={{ margin: '0 0 8px 0' }}>
            Workspace
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            File tree and Git status will attach here. Use agent tabs for chat and the terminal for commands.
          </p>
          <div className="cos-sec" style={{ marginTop: 12 }}>
            Preview
          </div>
          <button type="button" className="cos-item" onClick={() => openBrowserTab()}>
            Open Simple Browser
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '6px 0 0 0', lineHeight: 1.45 }}>
            View local dev servers (Vite, Next, etc.) in a tab, like Cursor’s built-in browser.
          </p>
        </div>
      </aside>
    )
  }

  if (activity === 'skills') {
    return <SkillsSide />
  }

  if (activity === 'memory') {
    return (
      <aside className="cos-side" aria-label="Memory">
        <div className="cos-sh">Memory</div>
        <div className="cos-sbody">
          <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
            Open a Memory tab for search and saved entries. This panel lists quick open actions.
          </p>
          <div className="cos-sec">Actions</div>
          <button
            type="button"
            className="cos-item"
            onClick={() => {
              openTab({ id: crypto.randomUUID(), title: 'Memory', type: 'memory', data: {} })
            }}
          >
            Open memory view
          </button>
        </div>
      </aside>
    )
  }

  if (activity === 'logs') {
    return (
      <aside className="cos-side" aria-label="Logs">
        <div className="cos-sh">Logs</div>
        <div className="cos-sbody">
          <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
            Provider and execution output lives in the bottom panel. Open a read-only log tab here.
          </p>
          <button
            type="button"
            className="cos-item"
            onClick={() => openTab({ id: crypto.randomUUID(), title: 'Logs', type: 'logs', data: {} })}
          >
            Open logs
          </button>
        </div>
      </aside>
    )
  }

  if (activity === 'headsets') {
    return (
      <aside className="cos-side" aria-label="Headsets">
        <div className="cos-sh">Headsets</div>
        <div className="cos-sbody">
          <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5, margin: '0 0 8px 0' }}>
            EMOTIV Insight and Cortex: connect, subscribe to streams, calibrate, and test the live brain map in the
            center editor.
          </p>
          <button
            type="button"
            className="cos-item"
            onClick={() => openTab({ id: CEREBRAL_HEADSETS_TAB_ID, title: 'Headsets', type: 'headsets', data: {} })}
          >
            Open Headsets tab
          </button>
        </div>
      </aside>
    )
  }

  if (activity === 'settings') {
    return (
      <aside className="cos-side" aria-label="Settings">
        <div className="cos-sh">Settings</div>
        <div className="cos-sbody">
          <div className="cos-sec">Open in editor</div>
          <button
            type="button"
            className="cos-item"
            onClick={() => openTab({ id: crypto.randomUUID(), title: 'settings.json (UI)', type: 'settings', data: { view: 'general' } })}
          >
            General settings
          </button>
          <button
            type="button"
            className="cos-item"
            onClick={() => openTab({ id: crypto.randomUUID(), title: 'Keyboard shortcuts', type: 'settings', data: { view: 'keyboard-shortcuts' } })}
          >
            Keyboard shortcuts
          </button>
          <button
            type="button"
            className="cos-item"
            onClick={() => openTab({ id: crypto.randomUUID(), title: 'API keys', type: 'settings', data: { view: 'api-keys' } })}
          >
            API keys
          </button>
          <button
            type="button"
            className="cos-item"
            onClick={() => openTab({ id: crypto.randomUUID(), title: 'Command encyclopedia', type: 'settings', data: { view: 'encyclopedia' } })}
          >
            Command encyclopedia
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.4, margin: '4px 0 6px' }}>
            Neural hardware: use the <strong>◎ Headsets</strong> activity in the left bar, or the Headsets tab.
          </p>
          <button
            type="button"
            className="cos-item"
            onClick={() => openTab({ id: crypto.randomUUID(), title: 'Local models', type: 'settings', data: { view: 'local-models' } })}
          >
            Local models / GGUF
          </button>
        </div>
      </aside>
    )
  }

  if (activity === 'swarms') {
    return (
      <aside className="cos-side" aria-label="Swarms">
        <div className="cos-sh">Swarm workflows</div>
        <div className="cos-sbody">
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 8px 0' }}>
            Node graph and orchestration controls open in a swarm tab.
          </p>
          <button
            type="button"
            className="cos-item"
            onClick={() => openTab({ id: crypto.randomUUID(), title: 'Swarm: Build Pipeline', type: 'swarm', data: { name: 'Build Pipeline' } })}
          >
            ⬡ Swarm: Build pipeline
          </button>
        </div>
      </aside>
    )
  }

  if (activity === 'providers') {
    return (
      <aside className="cos-side" aria-label="Providers">
        <div className="cos-sh">Model providers</div>
        <div className="cos-sbody">
          <ProviderSetupMap variant="side" />
          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 0 6px 0' }}>Test with “Reply only with OK.” in provider settings.</p>
          {provs.length === 0 && <p className="cos-mono">Loading…</p>}
          {provs.map((p) => (
            <button
              key={p.id}
              type="button"
              className="cos-item"
              onClick={() =>
                openTab({
                  id: crypto.randomUUID(),
                  title: `Provider: ${p.name}`,
                  type: 'provider_config',
                  data: { providerId: p.id }
                })
              }
            >
              <span>◫</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            </button>
          ))}
        </div>
      </aside>
    )
  }

  /* Default: agents (search, list, quick links) */
  return (
    <aside className="cos-side" aria-label={titles[activity] ?? 'Panel'}>
      <div className="cos-sh">{activity === 'agents' ? 'Agents' : titles[activity]}</div>
      <div className="cos-sbody">
        <input className="cos-inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents…" />
        {activity === 'agents' && (
          <>
            <button type="button" className="cos-btn" onClick={() => void onNewChat()} disabled={!activeAgent}>
              + New chat
            </button>
            <button
              type="button"
              className="cos-item"
              style={{ marginTop: 4, marginBottom: 10, fontSize: 11 }}
              onClick={() =>
                openTab({
                  id: crypto.randomUUID(),
                  title: 'My agents',
                  type: 'settings',
                  data: { view: 'my-agents' }
                })
              }
            >
              + Create agent
            </button>
            <div className="cos-sec">Conversations</div>
            {conversations.length === 0 && <p className="cos-mono">No conversations yet.</p>}
            {conversations.map((c) => {
              const current = c.id === sessionId
              return (
                <ConversationListRow
                  key={c.id}
                  c={c}
                  isCurrent={current}
                  onSelect={() => void onPickConversation(c)}
                  onRename={renameConversation}
                  className={`cos-item ${current ? 'cos-sel' : ''}`.trim()}
                  timeLabel={formatSessionListTime(c.startedAt)}
                  variant="cos"
                  stacked
                />
              )
            })}
            <div className="cos-sec">Active agents</div>
            {filtered.length === 0 && <p className="cos-mono">No matches.</p>}
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`cos-item ${activeAgent?.id === a.id ? 'cos-sel' : ''}`.trim()}
                onClick={() => onPickAgent(a)}
              >
                <RAAvatar agent={a} size={18} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
              </button>
            ))}
            <div className="cos-sec">Swarms</div>
            <button
              type="button"
              className="cos-item"
              onClick={() => {
                setActivity('swarms')
                openTab({ id: crypto.randomUUID(), title: 'Swarm: Build Pipeline', type: 'swarm', data: {} })
              }}
            >
              ⬡ Build pipeline
            </button>
            <div className="cos-sec">Providers</div>
            {provs.map((p) => (
              <button
                key={p.id}
                type="button"
                className="cos-item"
                onClick={() => {
                  setActivity('providers')
                  openTab({
                    id: crypto.randomUUID(),
                    title: `Provider: ${p.name}`,
                    type: 'provider_config',
                    data: { providerId: p.id }
                  })
                }}
              >
                ◫ {p.name}
              </button>
            ))}
            <div className="cos-sec">Local models</div>
            <button
              type="button"
              className="cos-item"
              onClick={() =>
                openTab({
                  id: crypto.randomUUID(),
                  title: 'Local models',
                  type: 'settings',
                  data: { view: 'local-models' }
                })
              }
            >
              ⬚ GGUF / Ollama / LM Studio
            </button>
          </>
        )}
      </div>
    </aside>
  )
}

function SkillsSide(): ReactNode {
  const { openTab } = useCerebralLayout()
  const [dbExtras, setDbExtras] = useState<Array<Record<string, unknown>>>([])
  const [wfCounts, setWfCounts] = useState(() => importCountsByWorkflow())
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const catalog = getClaudeCatalog()
  const categories = useMemo(() => categoriesWithCount(catalog.skills), [catalog.skills])
  const filtered = useMemo(
    () => filterCatalogSkills(catalog.skills, { q, category: cat }),
    [catalog.skills, q, cat]
  )

  useEffect(() => {
    void (async () => {
      const catIds = new Set(getClaudeCatalog().skills.map((s) => s.id))
      const fromDb = (await window.cerebral.skill.list()) as Array<Record<string, unknown>>
      setDbExtras(fromDb.filter((r) => r.id && !catIds.has(String(r.id))))
    })()
  }, [])

  useEffect(() => {
    const onCh = () => setWfCounts(importCountsByWorkflow())
    window.addEventListener('cerebral:workflow-skills-changed', onCh)
    return () => window.removeEventListener('cerebral:workflow-skills-changed', onCh)
  }, [])

  return (
    <aside className="cos-side" aria-label="Skills">
      <div className="cos-sh">Skills</div>
      <div className="cos-sbody">
        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
          Browse the Claude skills library and <strong>link</strong> skills to <strong>Vibe, Imagine, or Execute</strong> (Composer modes). The
          skill’s <code className="cos-mono">SKILL.md</code> is injected into the system prompt when you chat in that mode.
        </p>
        <div className="cos-sec">Skill marketplace</div>
        <p className="cos-mono" style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>
          Linked: Vibe {wfCounts.vibe} · Imagine {wfCounts.imagine} · Execute {wfCounts.execute}
        </p>
        <button
          type="button"
          className="cos-item"
          onClick={() =>
            openTab({
              id: crypto.randomUUID(),
              title: 'Skill marketplace',
              type: 'settings',
              data: { view: 'marketplace' }
            })
          }
        >
          Open full library — import for mode
        </button>
        <div className="cos-sec">Claude skills catalog</div>
        <p className="cos-mono" style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 6px' }}>
          {getCatalogSkillCount()} skills · search, category, or quick task filters. Multiple words = all must match.
        </p>
        <div className="cos-skill-browse" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
          <input
            className="cos-skill-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, path, task…"
            autoComplete="off"
            aria-label="Search skills"
          />
          <select
            className="cos-skill-select"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {categories.map(([c, n]) => (
              <option key={c} value={c}>
                {humanizeCategory(c)} ({n})
              </option>
            ))}
          </select>
          <div className="cos-skill-chips" role="group" aria-label="Categories">
            <button
              type="button"
              className={`cos-skill-chip ${cat === '' ? 'on' : ''}`}
              onClick={() => setCat('')}
            >
              All
            </button>
            {categories.map(([c]) => (
              <button
                key={c}
                type="button"
                className={`cos-skill-chip ${cat === c ? 'on' : ''}`}
                onClick={() => setCat(c)}
                title={c}
              >
                {humanizeCategory(c).replace(/ · /g, ' ')}
              </button>
            ))}
          </div>
          <div className="cos-skill-presets" role="group" aria-label="Quick task search">
            {SKILL_KEYWORD_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="cos-skill-preset"
                title={p.title ?? p.q}
                onClick={() => setQ((prev) => (prev.trim() ? `${prev} ${p.q}`.trim() : p.q))}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="cos-mono" style={{ fontSize: 9, color: 'var(--text-muted)', margin: 0 }}>
            Showing {filtered.length} of {catalog.skills.length}
          </p>
        </div>
        <div
          style={{
            maxHeight: 'min(55vh, 360px)',
            overflowY: 'auto',
            border: '1px solid var(--line, #1a2a3a)',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.2)'
          }}
        >
          {filtered.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 10, lineHeight: 1.4 }}>
              No match — clear search or try another category.
            </p>
          )}
          {filtered.map((s) => (
            <div key={s.id} className="cos-skill-row">
              <button
                type="button"
                className="cos-item cos-skill-item cos-skill-row-main"
                onClick={() =>
                  openTab({
                    id: crypto.randomUUID(),
                    title: s.title || s.name,
                    type: 'settings',
                    data: { view: 'skill', skillId: s.id }
                  })
                }
              >
                <span className="cos-skill-item-title">✦ {s.title || s.name}</span>
                <span className="cos-skill-item-cat" title={s.category}>
                  {humanizeCategory(s.category)}
                </span>
              </button>
              <div
                className="cos-skill-imp"
                role="group"
                aria-label="Link skill to workflow"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {WORKFLOW_SKILL_MODES.map((m) => {
                  const on = isSkillImportedForWorkflow(m.id, s.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={on ? 'on' : ''}
                      title={on ? `${m.label} — click to unlink` : `Link to ${m.label} (Composer)`}
                      onClick={() => {
                        if (on) {
                          removeSkillFromWorkflow(m.id, s.id)
                        } else {
                          importSkillForWorkflow(m.id, s.id)
                        }
                      }}
                    >
                      {m.short}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {dbExtras.length > 0 && (
          <>
            <div className="cos-sec" style={{ marginTop: 10 }}>
              Also in local DB
            </div>
            {dbExtras.map((s) => (
              <button
                key={String(s.id)}
                type="button"
                className="cos-item"
                onClick={() =>
                  openTab({
                    id: crypto.randomUUID(),
                    title: `Skill: ${String(s.name)}`,
                    type: 'settings',
                    data: { view: 'skill', skillId: s.id }
                  })
                }
              >
                ✦ {String(s.name)}
              </button>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}
