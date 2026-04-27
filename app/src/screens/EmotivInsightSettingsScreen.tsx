import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { InsightBrainVisualizerLive } from '@/cerebral/headsets'
import { HeadsetRegistry, parseCortexStreamData, type NormalizedEEGFrame, EMOTIV_INSIGHT_PROFILE } from '@/cerebral/headsets'
import { emotivCortex } from '@/services/EmotivCortexService'
import { AgentRuntimeService } from '@/services/AgentRuntimeService'
import { newId } from '@/services/mappers'

const SEC_RECORD = 10
const SEC_REST = 10
const ROUNDS_MIN = 5
const ROUNDS_MAX = 10
const SLEEP = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Command keys for calibration (stored in SQLite; mapped to in-app thought commands in intent layer). */
export const INSIGHT_CALIBRATION_COMMANDS = [
  'confirm',
  'reject',
  'continue',
  'stop',
  'switch_mode',
  'request_output',
  'summarize'
] as const

const DEFAULT_STREAMS = ['eeg', 'met', 'pow', 'com', 'dev']

export function EmotivInsightSettingsScreen() {
  const profile = HeadsetRegistry.get('emotiv_insight')?.profile
  const [cortexUrl, setCortexUrl] = useState('wss://localhost:6868')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [headsetId, setHeadsetId] = useState('')
  const [streams, setStreams] = useState(() => JSON.stringify(DEFAULT_STREAMS))
  const [rounds, setRounds] = useState(5)
  const [cortexTest, setCortexTest] = useState('')
  const [insightTest, setInsightTest] = useState('')
  const [calibStatus, setCalibStatus] = useState('')

  const samplesRef = useRef<NormalizedEEGFrame[]>([])
  const recordRef = useRef(false)
  const calibBusyRef = useRef(false)
  const [calibBusy, setCalibBusy] = useState(false)

  const load = useCallback(async () => {
    const s = await AgentRuntimeService.loadSettings()
    setCortexUrl(s.cortexUrl || 'wss://localhost:6868')
    setHeadsetId(s.emotivHeadsetId || '')
    if (s.emotivStreams?.length) {
      setStreams(JSON.stringify(s.emotivStreams))
    }
    const se = await window.ra.secrets.load()
    setClientId(se.emotiv_cortex_client_id ?? '')
    setClientSecret(se.emotiv_cortex_client_secret ?? '')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return emotivCortex.onStream((_, raw) => {
      if (!recordRef.current) {
        return
      }
      const f = parseCortexStreamData(EMOTIV_INSIGHT_PROFILE.id, EMOTIV_INSIGHT_PROFILE.name, raw)
      if (f) {
        samplesRef.current.push(f)
      }
    })
  }, [])

  const persistStreamList = (raw: string): string[] => {
    try {
      const p = JSON.parse(raw) as unknown
      if (Array.isArray(p) && p.every((x) => typeof x === 'string')) {
        return p
      }
    } catch {
      // ignore
    }
    return DEFAULT_STREAMS
  }

  const saveSettings = useCallback(async () => {
    const list = persistStreamList(streams)
    setStreams(JSON.stringify(list))
    await window.ra.settings.set({
      cortexUrl,
      emotivHeadsetId: headsetId,
      emotivStreams: list
    })
    await window.ra.secrets.set('emotiv_cortex_client_id', clientId)
    await window.ra.secrets.set('emotiv_cortex_client_secret', clientSecret)
    await emotivCortex.configure({ url: cortexUrl })
  }, [cortexUrl, headsetId, streams, clientId, clientSecret])

  const onTestCortex = useCallback(async () => {
    setCortexTest('Testing…')
    try {
      await saveSettings()
      const r = await emotivCortex.testCortex(cortexUrl)
      setCortexTest(r.ok ? 'Cortex reachable (WebSocket open).' : `Failed: ${r.error ?? 'unknown'}`)
    } catch (e) {
      setCortexTest(`Error: ${(e as Error).message}`)
    }
  }, [saveSettings, cortexUrl])

  const onTestInsight = useCallback(async () => {
    setInsightTest('Running Insight pipeline…')
    try {
      await saveSettings()
      const strList = persistStreamList(streams)
      const r = await emotivCortex.testInsightPipeline({
        url: cortexUrl,
        clientId,
        clientSecret,
        headsetId,
        streams: strList
      })
      if (r.ok) {
        setInsightTest(`Subscribed. Session: ${r.sessionId}`)
      } else {
        setInsightTest(`Failed: ${r.error}`)
      }
    } catch (e) {
      setInsightTest(`Error: ${(e as Error).message}`)
    }
  }, [saveSettings, cortexUrl, clientId, clientSecret, headsetId, streams])

  const runCalibration = useCallback(async () => {
    if (calibBusyRef.current) {
      return
    }
    calibBusyRef.current = true
    setCalibBusy(true)
    setCalibStatus('Starting…')
    const runId = newId()
    const strList = persistStreamList(streams)
    const nRounds = Math.min(ROUNDS_MAX, Math.max(ROUNDS_MIN, rounds))
    try {
      await saveSettings()
      const pipeline = await emotivCortex.testInsightPipeline({
        url: cortexUrl,
        clientId,
        clientSecret,
        headsetId,
        streams: strList
      })
      if (!pipeline.ok) {
        setCalibStatus(`Cortex: ${pipeline.error}`)
        calibBusyRef.current = false
        setCalibBusy(false)
        return
      }
    } catch (e) {
      setCalibStatus(`Connect failed: ${(e as Error).message}`)
      calibBusyRef.current = false
      setCalibBusy(false)
      return
    }
    try {
      for (const cmd of INSIGHT_CALIBRATION_COMMANDS) {
        for (let r = 0; r < nRounds; r++) {
          setCalibStatus(`${cmd} — round ${r + 1} / ${nRounds} — get ready (3s)`)
          await SLEEP(3000)
          setCalibStatus(`${cmd} — RECORD (${SEC_RECORD}s)`)
          samplesRef.current = []
          recordRef.current = true
          for (let t = SEC_RECORD; t > 0; t--) {
            setCalibStatus(`${cmd} — RECORD — ${t}s left`)
            await SLEEP(1000)
          }
          recordRef.current = false
          const json = JSON.stringify(samplesRef.current)
          await window.ra.insightCalibration.insert({
            id: newId(),
            command_key: cmd,
            calibration_run_id: runId,
            round_index: r,
            phase: 'record',
            sample_json: json,
            created_at: new Date().toISOString()
          })
          setCalibStatus(`${cmd} — REST (${SEC_REST}s)`)
          for (let t = SEC_REST; t > 0; t--) {
            setCalibStatus(`${cmd} — REST — ${t}s left`)
            await SLEEP(1000)
          }
        }
      }
      setCalibStatus('Calibration saved to SQLite.')
    } catch (e) {
      setCalibStatus(`Stopped: ${(e as Error).message}`)
    } finally {
      recordRef.current = false
      calibBusyRef.current = false
      setCalibBusy(false)
    }
  }, [saveSettings, cortexUrl, clientId, clientSecret, headsetId, streams, rounds])

  return (
    <div className="ra-screen" style={{ padding: 16, maxWidth: 960 }}>
      <h1 className="ra-h1">EMOTIV Insight</h1>
      <p style={{ color: 'var(--text-muted, #6f8097)', fontSize: 12, marginTop: 0 }}>
        {profile?.name} · {profile?.channels} channels · {HeadsetRegistry.list().map((h) => h.id).join(', ')}
      </p>
      <InsightBrainVisualizerLive />
      <p style={{ fontSize: 11, color: 'var(--text-muted, #6f8097)', marginTop: 6, lineHeight: 1.45 }}>
        2.5D map shows live band power, contact, and raw per channel when Cortex streams are active (not EMOTIV{' '}
        <em>BrainViz</em>—see{' '}
        <a href="https://www.emotiv.com/emotiv-brainviz" target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>
          emotiv.com/emotiv-brainviz
        </a>
        ). Subscribe to <code>pow</code>, <code>eeg</code>, <code>met</code>, and <code>dev</code> for contact. Idle
        preview is labeled; no fabricated values.
      </p>
      <p style={{ fontSize: 12 }}>
        Subscribes only to streams your license provides. Empty fields are not fabricated. Save before testing.
      </p>

      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12 }}>Cortex WebSocket URL</span>
          <input
            value={cortexUrl}
            onChange={(e) => setCortexUrl(e.target.value)}
            style={inp}
            autoComplete="off"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12 }}>Client ID</span>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} style={inp} autoComplete="off" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12 }}>Client Secret</span>
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            type="password"
            style={inp}
            autoComplete="off"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12 }}>Headset ID (from EMOTIV)</span>
          <input value={headsetId} onChange={(e) => setHeadsetId(e.target.value)} style={inp} autoComplete="off" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12 }}>Streams to subscribe (JSON array, e.g. [&quot;eeg&quot;,&quot;met&quot;])</span>
          <input value={streams} onChange={(e) => setStreams(e.target.value)} style={inp} autoComplete="off" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12 }}>Rounds per command ({ROUNDS_MIN}–{ROUNDS_MAX})</span>
          <input
            type="number"
            min={ROUNDS_MIN}
            max={ROUNDS_MAX}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
            style={{ ...inp, maxWidth: 120 }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <button type="button" className="cos-chip" onClick={() => void saveSettings()}>
          Save
        </button>
        <button type="button" className="cos-chip" onClick={() => void onTestCortex()}>
          Test Cortex
        </button>
        <button type="button" className="cos-chip" onClick={() => void onTestInsight()}>
          Test Insight
        </button>
        <button
          type="button"
          className="cos-chip"
          disabled={calibBusy}
          onClick={() => {
            void runCalibration()
          }}
        >
          Start calibration
        </button>
      </div>
      {cortexTest && <p style={{ fontSize: 12, marginTop: 8 }}>Cortex: {cortexTest}</p>}
      {insightTest && <p style={{ fontSize: 12, marginTop: 4 }}>Insight: {insightTest}</p>}
      {calibStatus && (
        <p style={{ fontSize: 12, marginTop: 8, fontFamily: 'var(--font-mono, monospace)' }}>{calibStatus}</p>
      )}
    </div>
  )
}

const inp: CSSProperties = {
  padding: 8,
  background: '#0b1422',
  color: '#e6ecf6',
  border: '1px solid #1b2b42',
  borderRadius: 4
}
