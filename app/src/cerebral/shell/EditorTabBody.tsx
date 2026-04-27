import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AgentChatWorkspace } from '@/components/ide/AgentChatWorkspace'
import { AgentProviderSettings } from '@/screens/AgentProviderSettings'
import { AgentMemoryScreen } from '@/screens/AgentMemoryScreen'
import { SwarmOrchestrationScreen } from '@/screens/SwarmOrchestrationScreen'
import { ResonantMyAgentsScreen } from '@/screens/ResonantMyAgentsScreen'
import { ResonantAgentsSettingsScreen } from '@/screens/ResonantAgentsSettingsScreen'
import { EmotivInsightSettingsScreen } from '@/screens/EmotivInsightSettingsScreen'
import { ResonantAgentsApiKeysScreen } from '@/screens/ResonantAgentsApiKeysScreen'
import { ResonantLocalModelsRAScreen } from '@/screens/ResonantLocalModelsRAScreen'
import { AgentSessionHistory } from '@/screens/AgentSessionHistory'
import { AppReportsScreen } from '@/screens/AppReportsScreen'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'
import type { CerebralTab } from '../types/cerebral.ts'
import { CerebralSkillMarketplace } from './CerebralSkillMarketplace'
import { CommandEncyclopediaScreen } from '@/cerebral/commands/CommandEncyclopediaScreen'
import { WorkspaceBrowserPanel } from './WorkspaceBrowserPanel'
import { getCatalogSkill } from '../skill/claudeCatalog'
import { fetchSkillMarkdown } from '../skill/skillMarkdownFetch'
import {
  importSkillForWorkflow,
  isSkillImportedForWorkflow,
  removeSkillFromWorkflow,
  WORKFLOW_SKILL_MODES
} from '../skill/workflowSkillImports'

export function EditorTabBody({ tab }: { tab: CerebralTab }): ReactNode {
  const { setActiveAgentId } = useResonantAgents()
  const view = tab.data && String(tab.data['view'] ?? '')

  useEffect(() => {
    if (tab.type === 'agent_chat' && tab.data && tab.data['agentId']) {
      setActiveAgentId(String(tab.data['agentId']))
    }
  }, [tab, setActiveAgentId])

  switch (tab.type) {
    case 'agent_chat':
      return (
        <div className="cos-embed" key={String(tab.data?.['agentId'] ?? tab.id)}>
          <AgentChatWorkspace />
        </div>
      )
    case 'provider_config':
      return (
        <div className="cos-embed" key={String(tab.data?.['providerId'] ?? tab.id)}>
          <AgentProviderSettings />
        </div>
      )
    case 'memory':
      return (
        <div className="cos-embed">
          <AgentMemoryScreen />
        </div>
      )
    case 'swarm':
      return (
        <div className="cos-embed">
          <SwarmOrchestrationScreen />
        </div>
      )
    case 'logs': {
      return <LogsView />
    }
    case 'report':
      return (
        <div className="cos-embed">
          <AppReportsScreen />
        </div>
      )
    case 'settings': {
      if (view === 'my-agents') {
        return (
          <div className="cos-embed">
            <ResonantMyAgentsScreen />
          </div>
        )
      }
      if (view === 'api-keys') {
        return (
          <div className="cos-embed">
            <ResonantAgentsApiKeysScreen />
          </div>
        )
      }
      if (view === 'local-models') {
        return (
          <div className="cos-embed">
            <ResonantLocalModelsRAScreen />
          </div>
        )
      }
      if (view === 'sessions') {
        return (
          <div className="cos-embed">
            <AgentSessionHistory />
          </div>
        )
      }
      if (view === 'marketplace') {
        return (
          <div className="cos-embed">
            <CerebralSkillMarketplace />
          </div>
        )
      }
      if (view === 'headsets') {
        return (
          <div className="cos-embed">
            <EmotivInsightSettingsScreen />
          </div>
        )
      }
      if (view === 'encyclopedia') {
        return (
          <div className="cos-embed">
            <CommandEncyclopediaScreen />
          </div>
        )
      }
      if (view === 'skill' && tab.data && tab.data['skillId']) {
        return <SkillView skillId={String(tab.data['skillId'])} />
      }
      return (
        <div className="cos-embed">
          <ResonantAgentsSettingsScreen />
        </div>
      )
    }
    case 'code': {
      const rel = String(tab.data?.['path'] ?? 'untitled')
      return (
        <div className="cos-embed" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <WorkspaceCodeView relativePath={rel} />
        </div>
      )
    }
    case 'browser':
      return (
        <div
          className="cos-embed cos-embed--browser"
          style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
        >
          <WorkspaceBrowserPanel key={tab.id} tab={tab} />
        </div>
      )
    default:
      return (
        <div className="cos-empty">
          <p>Unknown tab type: {String(tab.type)}</p>
        </div>
      )
  }
}

function WorkspaceCodeView({ relativePath }: { relativePath: string }): ReactNode {
  const [text, setText] = useState<string>('Loading…')
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (relativePath === '__untitled__' || relativePath === 'untitled') {
      setText('')
      setErr(null)
      return
    }
    let ok = true
    void (async () => {
      const r = await window.cerebral.workspace.readFile({ relativePath, workspaceId: 'default' })
      if (!ok) {
        return
      }
      if (r.ok) {
        setText(r.content)
        setErr(null)
      } else {
        setText('')
        setErr(r.error)
      }
    })()
    return () => {
      ok = false
    }
  }, [relativePath])
  return (
    <>
      <div
        style={{
          flex: 'none',
          padding: '8px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
          borderBottom: '1px solid #142236',
          fontFamily: 'var(--font-mono, monospace)',
          wordBreak: 'break-all'
        }}
        title={relativePath}
      >
        {relativePath}
      </div>
      {err && (
        <p style={{ flex: 'none', margin: '8px 12px', fontSize: 12, color: '#e88' }}>
          {err}
        </p>
      )}
      <pre
        className="cos-mono"
        style={{
          flex: 1,
          margin: 0,
          padding: 12,
          overflow: 'auto',
          minHeight: 120,
          fontSize: 12,
          color: '#9fadc2',
          background: '#000309',
          border: 'none',
          borderTop: '1px solid #142236'
        }}
      >
        {text}
      </pre>
    </>
  )
}

function LogsView(): ReactNode {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    void (async () => {
      setRows((await window.cerebral.providerLog.list(200)) as Array<Record<string, unknown>>)
    })()
  }, [])
  return (
    <div className="cos-embed" style={{ padding: 8 }}>
      <h3 style={{ margin: '0 0 6px 0', fontSize: 13, color: '#c4d0e0' }}>Provider logs</h3>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px 0' }}>API keys are never written here — only model id, success, and error summary.</p>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}>
        {rows.length === 0 && 'No entries yet — send a chat message to create logs.'}
        {rows.map((r) => (
          <p key={String(r.id)} style={{ borderBottom: '1px solid #142236', margin: 0, padding: '4px 0' }}>
            {String(r.created_at)} {String(r.success) === '1' ? 'OK' : 'ERR'} {String(r.model_name ?? '')}{' '}
            {r.error_message ? String(r.error_message).slice(0, 200) : ''}
          </p>
        ))}
      </div>
    </div>
  )
}

function SkillView({ skillId }: { skillId: string }): ReactNode {
  const [linkTick, setLinkTick] = useState(0)
  const [md, setMd] = useState<string | null>(null)
  const [mdState, setMdState] = useState<'idle' | 'loading' | 'err'>('idle')
  const [mdErr, setMdErr] = useState<string | null>(null)
  const [dbJson, setDbJson] = useState<string | null>(null)

  const cat = getCatalogSkill(skillId)

  const modeLinked = useMemo(
    () =>
      Object.fromEntries(
        WORKFLOW_SKILL_MODES.map((m) => [m.id, isSkillImportedForWorkflow(m.id, skillId)] as const)
      ) as Record<string, boolean>,
    [skillId, linkTick]
  )

  useEffect(() => {
    const onCh = () => setLinkTick((t) => t + 1)
    window.addEventListener('cerebral:workflow-skills-changed', onCh)
    return () => window.removeEventListener('cerebral:workflow-skills-changed', onCh)
  }, [])

  useEffect(() => {
    setMd(null)
    setMdErr(null)
    setDbJson(null)
    const c = getCatalogSkill(skillId)
    if (c) {
      setMdState('loading')
      void fetchSkillMarkdown(c)
        .then((t) => {
          setMd(t.trim() || null)
          setMdState('idle')
        })
        .catch((e: Error) => {
          setMdErr(e.message || 'Failed to load SKILL.md')
          setMdState('err')
        })
      return
    }
    void (async () => {
      const list = (await window.cerebral.skill.list()) as Array<Record<string, unknown>>
      const s = list.find((x) => String(x.id) === skillId)
      setDbJson(s ? JSON.stringify(s, null, 2) : 'Skill not found in catalog or local DB')
    })()
  }, [skillId])

  return (
    <div className="cos-embed" style={{ padding: 8, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <h3 style={{ fontSize: 13, color: '#c4d0e0', margin: '0 0 6px 0' }}>{cat ? cat.title : `Skill ${skillId}`}</h3>
      {cat && (
        <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 6px 0' }}>
          {cat.category} ·{' '}
          <a href={cat.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#6ab0ff' }}>
            Open on GitHub
          </a>
        </p>
      )}
      {cat && (
        <div
          className="cos-skill-imp"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}
          role="group"
          aria-label="Link to Composer mode"
        >
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4 }}>Linked:</span>
          {WORKFLOW_SKILL_MODES.map((m) => {
            const on = modeLinked[m.id] ?? false
            return (
              <button
                key={m.id}
                type="button"
                className={on ? 'on' : ''}
                style={{ width: 'auto', height: 26, padding: '0 10px' }}
                title={on ? `${m.label} — click to remove` : `Add SKILL.md to ${m.label} chats`}
                onClick={() => {
                  if (on) {
                    removeSkillFromWorkflow(m.id, skillId)
                  } else {
                    importSkillForWorkflow(m.id, skillId)
                  }
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      )}
      {mdState === 'loading' && <p className="cos-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading SKILL.md…</p>}
      {mdErr && (
        <p className="cos-mono" style={{ fontSize: 11, color: '#c08080' }}>
          {mdErr} — showing catalog metadata below.
        </p>
      )}
      <pre
        style={{
          flex: 1,
          background: '#000309',
          border: '1px solid #142236',
          padding: 8,
          fontSize: 10,
          color: '#9fadc2',
          overflow: 'auto',
          minHeight: 200,
          margin: 0
        }}
      >
        {cat
          ? md ||
            (mdState === 'loading'
              ? '…'
              : [
                  `title: ${cat.title}`,
                  `name: ${cat.name}`,
                  `category: ${cat.category}`,
                  `description:\n${cat.description || '—'}`,
                  `tags: ${(cat.tags || []).join(', ') || '—'}`,
                  `relativePath: ${cat.relativePath}`,
                  `raw: ${cat.rawUrl}`,
                  `source: ${cat.sourceUrl}`
                ].join('\n\n'))
          : (dbJson ?? '…')}
      </pre>
    </div>
  )
}
