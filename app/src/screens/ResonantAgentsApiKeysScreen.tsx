import { useEffect, useState } from 'react'
import { secureStorage } from '@/services/SecureStorageService'
import { AgentProviderService } from '../services/AgentProviderService'
import type { ModelProviderConfig } from '../types'

const KEYS = {
  or: 'openrouter_api_key',
  oai: 'openai_api_key',
  an: 'anthropic_api_key',
  gem: 'google_gemini_api_key'
} as const

/**
 * Optional bridge: sync cloud keys with shared secure store + RA provider table keys.
 * Provider table remains source of truth for Cerebral orchestration; this screen mirrors for convenience.
 */
export function ResonantAgentsApiKeysScreen() {
  const [o, setO] = useState({ or: '', oai: '', an: '', gem: '' })
  const [p, setP] = useState<ModelProviderConfig[]>([])

  useEffect(() => {
    void (async () => {
      const a = await secureStorage.loadAll()
      setO({
        or: a[KEYS.or] ? '********' : '',
        oai: a[KEYS.oai] ? '********' : '',
        an: a[KEYS.an] ? '********' : '',
        gem: a[KEYS.gem] ? '********' : ''
      })
      setP(await AgentProviderService.list())
    })()
  }, [])

  return (
    <div className="ra-screen" style={{ padding: 16 }}>
      <h1 className="ra-h1">API keys (shared secure store)</h1>
      <p className="ra-mute">Values are masked. Prefer provider pages for RA-specific wiring; you may paste keys that map to shared app secret keys for interoperability.</p>
      <p className="ra-mute" style={{ color: '#ffb020' }}>
        For Cerebral OS chat, keys attached to each provider in Model Providers are used first.
      </p>
      <div className="ra-form" style={{ maxWidth: 480, marginTop: 12 }}>
        {(
          [
            ['OpenRouter (optional shared)', KEYS.or, o.or],
            ['OpenAI (optional shared)', KEYS.oai, o.oai],
            ['Anthropic (optional shared)', KEYS.an, o.an],
            ['Gemini (optional shared)', KEYS.gem, o.gem]
          ] as const
        ).map(([label, k, v]) => (
          <label key={k}>
            {label}
            <input
              type="password"
              placeholder="••••"
              value={v === '********' ? '' : v}
              onChange={async (e) => {
                if (e.target.value) {
                  await secureStorage.set(k, e.target.value)
                }
              }}
            />
          </label>
        ))}
      </div>
      <h2 className="ra-h1" style={{ fontSize: 14, marginTop: 20 }}>
        RA providers
      </h2>
      <ul className="ra-mute" style={{ fontSize: 12 }}>
        {p.map((x) => (
          <li key={x.id}>
            {x.name} — {x.type} — key in secure store: {x.type === 'ollama' || x.type === 'lmstudio' ? 'n/a' : 'per-provider id'}
          </li>
        ))}
      </ul>
    </div>
  )
}
