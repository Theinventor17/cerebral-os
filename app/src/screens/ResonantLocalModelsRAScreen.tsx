import { useEffect, useState } from 'react'
import { LocalGGUFRegistry } from '../services/LocalGGUFRegistry'

export function ResonantLocalModelsRAScreen() {
  const [paths, setPaths] = useState<string[]>([''])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void (async () => {
      const p = await LocalGGUFRegistry.listPaths()
      setPaths(p.length ? p : [''])
    })()
  }, [])

  const save = () => {
    const cleaned = paths.map((p) => p.trim()).filter(Boolean)
    void LocalGGUFRegistry.setPaths(cleaned)
    setMsg('Paths saved (placeholder registry). Start llama.cpp server separately and point a provider to it.')
  }

  return (
    <div className="ra-screen" style={{ padding: 16 }}>
      <h1 className="ra-h1">Local models & GGUF</h1>
      <p className="ra-mute">Register GGUF file paths for reference; execution goes through a local server (Ollama, llama.cpp, or LM Studio) configured under Providers.</p>
      {paths.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            style={{ flex: 1, background: '#0b1422', border: '1px solid #1b2b42', color: '#f4f8ff', borderRadius: 6, padding: 8 }}
            value={p}
            onChange={(e) => {
              const n = [...paths]
              n[i] = e.target.value
              setPaths(n)
            }}
            placeholder="C:\models\file.gguf"
          />
        </div>
      ))}
      <button type="button" className="ra-btn ra-btn-sm" onClick={() => setPaths((x) => [...x, ''])}>
        Add path
      </button>
      <div style={{ marginTop: 10 }}>
        <button type="button" className="ra-btn" onClick={save}>
          Save paths
        </button>
      </div>
      {msg && <p className="ra-ok">{msg}</p>}
    </div>
  )
}
