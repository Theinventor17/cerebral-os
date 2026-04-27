import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RAAvatar } from '../components/RAIcons'
import type { ModelProviderConfig, ResonantAgent } from '../types'
import { agentToRow, rowToAgent } from '../services/mappers'
import { AgentProviderService } from '../services/AgentProviderService'
import { useResonantAgents } from '../providers/ResonantAgentsProvider'

export function ResonantMyAgentsScreen() {
  const { setActiveAgentId } = useResonantAgents()
  const [agents, setAgents] = useState<ResonantAgent[]>([])
  const [providers, setProviders] = useState<ModelProviderConfig[]>([])

  const load = useCallback(async () => {
    const arows = (await window.ra.agent.list()) as Array<Record<string, unknown>>
    setAgents(arows.map(rowToAgent))
    setProviders(await AgentProviderService.list())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="ra-screen" style={{ padding: 16 }}>
      <h1 className="ra-h1">My agents</h1>
      <p className="ra-mute">
        Assign a provider and model to each agent. If the assigned provider is missing or turned off, the default “chat” provider is used. To use OpenRouter or any cloud API, open{' '}
        <Link to="/app/providers" style={{ color: 'var(--accent, #9b5cff)' }}>
          Model providers
        </Link>
        , check <strong>Enabled</strong> and <strong>Save</strong> for that provider first.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, marginTop: 12 }}>
        {agents.map((a) => (
          <AgentCard key={a.id} agent={a} providers={providers} onSave={load} setActiveAgentId={setActiveAgentId} />
        ))}
      </div>
    </div>
  )
}

function AgentCard({
  agent: a,
  providers,
  onSave,
  setActiveAgentId
}: {
  agent: ResonantAgent
  providers: ModelProviderConfig[]
  setActiveAgentId: (id: string) => void
  onSave: () => void
}) {
  const [providerId, setProviderId] = useState(a.providerId)
  const [modelName, setModelName] = useState(a.modelName)
  const [modelOptions, setModelOptions] = useState<Array<{ id: string; name: string }>>([])
  const [modelLoading, setModelLoading] = useState(false)
  const [modelListNote, setModelListNote] = useState<string | null>(null)
  const [temp, setTemp] = useState(a.temperature != null ? String(a.temperature) : '')
  const [maxTok, setMaxTok] = useState(a.maxOutputTokens != null ? String(a.maxOutputTokens) : '')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setProviderId(a.providerId)
    setModelName(a.modelName)
    setTemp(a.temperature != null ? String(a.temperature) : '')
    setMaxTok(a.maxOutputTokens != null ? String(a.maxOutputTokens) : '')
  }, [a])

  const selectedProvider = useMemo(() => providers.find((p) => p.id === providerId), [providers, providerId])

  useEffect(() => {
    if (!providerId || !selectedProvider) {
      setModelOptions([])
      setModelListNote(null)
      return
    }
    let cancelled = false
    setModelLoading(true)
    setModelListNote(null)
    void (async () => {
      try {
        const r = await AgentProviderService.listModels(providerId)
        if (cancelled) {
          return
        }
        let opts = (r.models ?? []).map((m) => ({ id: m.id, name: m.name }))
        if (a.modelName && !opts.some((o) => o.id === a.modelName)) {
          opts = [...opts, { id: a.modelName, name: `${a.modelName} (current agent value)` }]
        }
        setModelOptions(opts)
        if (r.error) {
          setModelListNote(r.error)
        } else {
          setModelListNote(null)
        }
        const ids = new Set(opts.map((o) => o.id))
        setModelName((prev) => {
          if (providerId === a.providerId && ids.has(a.modelName)) {
            return a.modelName
          }
          if (ids.has(prev)) {
            return prev
          }
          if (ids.has(r.defaultModel)) {
            return r.defaultModel
          }
          if (ids.has(selectedProvider.modelName)) {
            return selectedProvider.modelName
          }
          return opts[0]?.id ?? selectedProvider.modelName
        })
      } catch (e) {
        if (!cancelled) {
          setModelListNote((e as Error).message)
          setModelOptions([{ id: a.modelName, name: a.modelName }])
        }
      } finally {
        if (!cancelled) {
          setModelLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [providerId, selectedProvider, a.id, a.providerId, a.modelName])

  const save = async () => {
    const t = new Date().toISOString()
    const next: ResonantAgent = {
      ...a,
      providerId,
      modelName,
      temperature: temp.trim() === '' ? undefined : Number(temp),
      maxOutputTokens: maxTok.trim() === '' ? undefined : Number(maxTok),
      updatedAt: t
    }
    await window.ra.agent.upsert(agentToRow(next) as never)
    setMsg('Saved')
    onSave()
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr',
        gap: 12,
        background: '#0b1422',
        border: '1px solid #1b2b42',
        borderRadius: 8,
        padding: 12
      }}
    >
      <RAAvatar agent={a} size={48} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <strong style={{ color: a.color }}>{a.name}</strong>
          <span className="ra-mute" style={{ fontSize: 11 }}>
            {a.role}
          </span>
          <button type="button" className="ra-btn ra-btn-sm" onClick={() => setActiveAgentId(a.id)}>
            Use in session
          </button>
        </div>
        <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          Provider
          <select
            style={{ display: 'block', width: '100%', maxWidth: 400, marginTop: 4, padding: 6, background: '#081127', color: '#e6ecf6', border: '1px solid #1b2b42' }}
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.type}){!p.enabled ? ' — off in Model providers' : ''}
              </option>
            ))}
          </select>
        </label>
        {selectedProvider && !selectedProvider.enabled && (
          <p className="ra-mute" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4, maxWidth: 400 }}>
            This provider is not enabled yet. Open{' '}
            <Link to="/app/providers" style={{ color: 'var(--accent, #9b5cff)' }}>
              Model providers
            </Link>
            , turn on <strong>Enabled</strong> for {selectedProvider.name}, then <strong>Save</strong>. Until then, chat may fall back to your default chat provider.
          </p>
        )}
        <label style={{ display: 'block', fontSize: 11, marginTop: 6 }}>
          Model
          {modelLoading ? (
            <span className="ra-mute" style={{ display: 'block', marginTop: 6 }}>
              Loading models…
            </span>
          ) : modelOptions.length > 0 ? (
            <select
              style={{ display: 'block', width: '100%', maxWidth: 400, marginTop: 4, padding: 6, background: '#081127', color: '#e6ecf6', border: '1px solid #1b2b42' }}
              value={
                modelOptions.some((o) => o.id === modelName) ? modelName : (modelOptions[0]?.id ?? modelName)
              }
              onChange={(e) => setModelName(e.target.value)}
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              style={{ display: 'block', width: '100%', maxWidth: 400, marginTop: 4, padding: 6 }}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Model id"
            />
          )}
        </label>
        {modelListNote && (
          <p className="ra-mute" style={{ fontSize: 10, marginTop: 4, lineHeight: 1.35, maxWidth: 400 }}>
            {modelListNote}
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6, maxWidth: 400 }}>
          <label style={{ display: 'block', fontSize: 11 }}>
            Temperature (optional)
            <input
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              placeholder="Use provider default"
            />
          </label>
          <label style={{ display: 'block', fontSize: 11 }}>
            Max output tokens (optional)
            <input
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
              value={maxTok}
              onChange={(e) => setMaxTok(e.target.value)}
              placeholder="Use provider default"
            />
          </label>
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="ra-btn" onClick={() => void save()}>
            Save agent
          </button>
          {msg && <span className="ra-ok" style={{ fontSize: 12 }}>{msg}</span>}
        </div>
      </div>
    </div>
  )
}
