import { useCallback, useEffect, useState } from 'react'
import type { ModelProviderConfig, ProviderType } from '../types'
import { AgentProviderService } from '../services/AgentProviderService'
import { newId, rowToProvider } from '../services/mappers'
import { LMStudioService } from '../services/LMStudioService'
import { useResonantAgents } from '../providers/ResonantAgentsProvider'
import { OPENROUTER_CHAT_SAFE_PRESETS } from '../constants/openRouterChatSafePresets'

const TYPES: ProviderType[] = [
  'ollama',
  'lmstudio',
  'llama_cpp',
  'openrouter',
  'openai',
  'anthropic',
  'gemini',
  'custom_openai',
  'local_gguf'
]

const DEFAULTS: Record<ProviderType, { endpoint: string }> = {
  ollama: { endpoint: 'http://localhost:11434/v1/chat/completions' },
  lmstudio: { endpoint: 'http://localhost:1234/v1/chat/completions' },
  llama_cpp: { endpoint: 'http://localhost:8080/v1/chat/completions' },
  openrouter: { endpoint: 'https://openrouter.ai/api/v1/chat/completions' },
  openai: { endpoint: 'https://api.openai.com/v1/chat/completions' },
  anthropic: { endpoint: 'https://api.anthropic.com/v1/messages' },
  gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
  custom_openai: { endpoint: 'http://127.0.0.1:5000/v1/chat/completions' },
  local_gguf: { endpoint: 'http://localhost:8080/v1/chat/completions' }
}

export function AgentProviderSettings() {
  const { localOnly, setLocalOnly, showReasoningStream, setShowReasoningStream } = useResonantAgents()
  const [list, setList] = useState<ModelProviderConfig[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [form, setForm] = useState<ModelProviderConfig | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [hadKey, setHadKey] = useState(false)
  const [msg, setMsg] = useState('')
  const [test, setTest] = useState('')

  const load = useCallback(async () => {
    const p = await AgentProviderService.list()
    setList(p)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!sel) {
      return
    }
    void (async () => {
      const r = (await window.ra.provider.get(sel)) as Record<string, unknown> | null
      if (r) {
        setForm(rowToProvider(r))
        const has = await window.ra.provider.hasKey(sel)
        setHadKey(has)
        setKeyInput(has ? '••••••••' : '')
      }
    })()
  }, [sel])

  useEffect(() => {
    if (list.length && !sel) {
      setSel(list[0].id)
    }
  }, [list, sel])

  const save = async () => {
    if (!form) {
      return
    }
    const t = new Date().toISOString()
    const next: ModelProviderConfig = { ...form, updatedAt: t }
    const mask = '••••••••' as const
    if (keyInput !== mask) {
      next.apiKey = keyInput
    }
    const isMasked = keyInput === mask
    const apiKeyTouched = !isMasked || (hadKey && keyInput.length === 0)
    if (next.defaultForChat) {
      for (const o of list) {
        if (o.id !== next.id && o.defaultForChat) {
          await AgentProviderService.save({ ...o, defaultForChat: false, updatedAt: t }, { apiKeyTouched: false })
        }
      }
    }
    await AgentProviderService.save(next, { apiKeyTouched })
    if (keyInput.length === 0 && hadKey) {
      setHadKey(false)
    } else if (keyInput.length > 0 && keyInput !== mask) {
      setHadKey(true)
      setKeyInput(mask)
    }
    setMsg('Saved')
    void load()
  }

  const addProvider = () => {
    void (async () => {
      const t = new Date().toISOString()
      const id = newId()
      const p = await AgentProviderService.create({
        id,
        name: 'New provider',
        type: 'ollama',
        endpointUrl: DEFAULTS.ollama.endpoint,
        modelName: 'llama3.2',
        createdAt: t,
        updatedAt: t
      })
      setSel(p.id)
      void load()
    })()
  }

  const removeProvider = () => {
    if (!form) {
      return
    }
    if (!window.confirm(`Delete provider “${form.name}”?`)) {
      return
    }
    void (async () => {
      await AgentProviderService.remove(form.id)
      setSel(null)
      setForm(null)
      setTest('')
      void load()
    })()
  }

  return (
    <div className="ra-screen" style={{ padding: 16 }}>
      <h1 className="ra-h1">Model providers</h1>
      <p className="ra-mute" style={{ marginTop: 0 }}>
        API keys are stored in secure storage, never written to logs, and masked in the UI. Test sends: “Reply only with OK.”
      </p>
      <p className="ra-mute" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 0, marginBottom: 12, maxWidth: 720 }}>
        Some <strong>free / frontier</strong> OpenRouter models do not stream normal assistant <strong>content</strong> reliably (they may emit reasoning, tool, or empty deltas only). For everyday chat, pick a
        <strong> chat or instruct</strong> model, or use a preset below.
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <input type="checkbox" checked={localOnly} onChange={(e) => void setLocalOnly(e.target.checked)} />
        Local-only mode (disables all cloud provider usage and tests)
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={showReasoningStream}
          onChange={(e) => void setShowReasoningStream(e.target.checked)}
        />
        Show reasoning stream (append model reasoning / chain-of-thought tokens to the reply when the API sends them)
      </label>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="ra-btn" onClick={addProvider}>
          + Add provider
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSel(p.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginBottom: 4,
                padding: 8,
                background: sel === p.id ? 'rgba(155,92,255,0.2)' : '#0b1422',
                border: '1px solid ' + (sel === p.id ? '#9b5cff' : '#1b2b42'),
                color: '#e6ecf6',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <strong>{p.name}</strong>
              <div style={{ fontSize: 10, color: '#6f8097' }}>{p.type}</div>
            </button>
          ))}
        </div>
        {form && (
          <div className="ra-form">
            <label>
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Type
              <select
                value={form.type}
                onChange={(e) => {
                  const t = e.target.value as ProviderType
                  setForm({ ...form, type: t, endpointUrl: DEFAULTS[t].endpoint })
                }}
              >
                {TYPES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Endpoint URL
              <input value={form.endpointUrl} onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })} />
            </label>
            <label>
              Model name
              <input value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} />
            </label>
            {form.type === 'openrouter' && (
              <div style={{ marginBottom: 8 }}>
                <div className="ra-mute" style={{ fontSize: 11, marginBottom: 6 }}>
                  Known chat-safe presets (click to set model name):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {OPENROUTER_CHAT_SAFE_PRESETS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="ra-btn ra-btn-ghost"
                      style={{ fontSize: 10, padding: '4px 8px' }}
                      onClick={() => setForm({ ...form, modelName: id })}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label>
              API key (hidden in logs)
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                autoComplete="off"
                placeholder={hadKey ? 'Replace or clear' : 'Optional for local'}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />{' '}
              Enabled
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.localOnly}
                onChange={(e) => setForm({ ...form, localOnly: e.target.checked })}
              />{' '}
              Mark as local
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.defaultForChat}
                onChange={(e) => setForm({ ...form, defaultForChat: e.target.checked })}
              />{' '}
              Default for chat (fallback when an agent has no working provider)
            </label>
            <label>
              Temperature
              <input
                type="number"
                step="0.05"
                min="0"
                max="2"
                value={form.temperature ?? ''}
                onChange={(e) =>
                  setForm({ ...form, temperature: e.target.value === '' ? undefined : Number(e.target.value) })
                }
              />
            </label>
            <label>
              Max output tokens
              <input
                type="number"
                value={form.maxOutputTokens ?? ''}
                onChange={(e) =>
                  setForm({ ...form, maxOutputTokens: e.target.value === '' ? undefined : Number(e.target.value) })
                }
              />
            </label>
            {form.type === 'local_gguf' && (
              <>
                <label>
                  Local GGUF path (registry placeholder)
                  <input
                    value={form.localGgufPath ?? ''}
                    onChange={(e) => setForm({ ...form, localGgufPath: e.target.value || undefined })}
                  />
                </label>
                <label>
                  Hugging Face GGUF import (placeholder)
                  <input
                    value={form.hfImportUrl ?? ''}
                    onChange={(e) => setForm({ ...form, hfImportUrl: e.target.value || undefined })}
                  />
                </label>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="ra-btn" onClick={() => void save()}>
                Save
              </button>
              <button type="button" className="ra-btn ra-btn-ghost" onClick={removeProvider}>
                Delete
              </button>
              <button
                type="button"
                className="ra-btn ra-btn-ghost"
                onClick={async () => {
                  setTest('Testing…')
                  const r = await AgentProviderService.testConnection(form.id)
                  const R = r as { ok: boolean; error?: string; modelName?: string; sample?: string; endpoint?: string }
                  if (R.ok) {
                    const lines = [
                      'Success',
                      R.modelName ? `Model: ${R.modelName}` : '',
                      R.endpoint ? `Endpoint: ${R.endpoint}` : '',
                      R.sample != null ? `Response: ${R.sample}` : ''
                    ].filter(Boolean)
                    if (!form.enabled) {
                      lines.push('Note: Enable this provider and click Save to use it in chat.')
                    }
                    setTest(lines.join('\n'))
                  } else {
                    setTest(R.error ?? 'Failed')
                  }
                }}
              >
                Test connection
              </button>
              {form.type === 'lmstudio' && (
                <button
                  type="button"
                  className="ra-btn ra-btn-ghost"
                  onClick={async () => {
                    setTest('Testing LM Studio…')
                    const r = await LMStudioService.testSession(form.id)
                    setTest(r.ok ? 'LM Studio session OK' : (r as { error?: string }).error ?? 'fail')
                  }}
                >
                  Test LM Studio Session
                </button>
              )}
            </div>
            {msg && <div className="ra-ok">{msg}</div>}
            {test && (
              <pre
                className="ra-ok"
                style={{
                  color: test.toLowerCase().includes('fail') || test.toLowerCase().includes('off') || test.toLowerCase().includes('error') ? '#ff4d5e' : '#35f28a',
                  whiteSpace: 'pre-wrap',
                  fontSize: 11,
                  maxHeight: 200,
                  overflow: 'auto'
                }}
              >
                {test}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
