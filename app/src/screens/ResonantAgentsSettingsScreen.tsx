import { useCallback, useEffect, useState } from 'react'
import { CEREBRAL_HEADSETS_TAB_ID } from '../cerebral/headsetsTabConstants'
import { useCerebralLayout } from '../cerebral/context/CerebralTabContext'
import { useResonantAgents } from '../providers/ResonantAgentsProvider'
import { AgentProviderService } from '../services/AgentProviderService'
import type { ModelProviderConfig } from '../types'

export function ResonantAgentsSettingsScreen() {
  const { openTab, setActivity } = useCerebralLayout()
  const { localOnly, setLocalOnly, autoListen, setAutoListen, demoMode, setDemoMode } = useResonantAgents()
  const [providers, setProviders] = useState<ModelProviderConfig[]>([])
  const [guideId, setGuideId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const s = await window.ra.settings.get()
    setGuideId(s.guideProviderId)
    const list = await AgentProviderService.list()
    setProviders(list)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="ra-screen" style={{ padding: 16 }}>
      <h1 className="ra-h1">CEREBRAL OS settings</h1>
      <div style={{ marginBottom: 16, maxWidth: 520 }}>
        <div className="ra-mute" style={{ fontSize: 12, marginBottom: 6 }}>
          Workspace root (default folder for agent file writes, terminal cwd, and approvals)
        </div>
        <button
          type="button"
          className="ra-btn"
          onClick={() => {
            void (async () => {
              const c = window.cerebral
              if (!c?.workspace?.pickDirectory) {
                return
              }
              const r = await c.workspace.pickDirectory()
              if (r.path) {
                const setR = await c.workspace.setRoot({ rootPath: r.path })
                if (setR.ok) {
                  try {
                    window.dispatchEvent(new CustomEvent('cerebral:workspace:mutated', { detail: { source: 'settings' } }))
                  } catch {
                    // ignore
                  }
                }
              }
            })()
          }}
        >
          Choose workspace folder…
        </button>
      </div>
      <p style={{ fontSize: 12, marginBottom: 16 }}>
        <button
          type="button"
          className="cos-chip"
          onClick={() =>
            openTab({ id: crypto.randomUUID(), title: 'Command encyclopedia', type: 'settings', data: { view: 'encyclopedia' } })
          }
        >
          Command encyclopedia
        </button>
        <button
          type="button"
          className="cos-chip"
          onClick={() => {
            setActivity('headsets')
            openTab({ id: CEREBRAL_HEADSETS_TAB_ID, title: 'Headsets', type: 'headsets', data: {} })
          }}
        >
          Open Headsets (EMOTIV Insight)
        </button>
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input type="checkbox" checked={localOnly} onChange={(e) => void setLocalOnly(e.target.checked)} />
        Local-only mode — disables cloud provider usage in-process; local models (Ollama, LM Studio, etc.) still work
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input type="checkbox" checked={autoListen} onChange={(e) => void setAutoListen(e.target.checked)} />
        Auto-listen (thought channel polling UI)
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <input type="checkbox" checked={demoMode} onChange={(e) => void setDemoMode(e.target.checked)} />
        Demo mode — show sample memory / Forge transcript placeholders (development only; default off)
      </label>
      <div style={{ maxWidth: 480 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
          Guide provider (optional — defaults to the provider marked &quot;default for chat&quot;)
          <select
            style={{ display: 'block', width: '100%', marginTop: 6, padding: 8, background: '#0b1422', color: '#e6ecf6', border: '1px solid #1b2b42' }}
            value={guideId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setGuideId(v || null)
              void window.ra.settings.set({ guideProviderId: v || null })
            }}
          >
            <option value="">— Default chat provider —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.enabled}>
                {p.name} ({p.type}){!p.enabled ? ' — disabled' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
