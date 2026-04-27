import type { EmotivStreamSnapshot } from '@/types/eeg'

type HeadsetRow = { id: string; firmware?: string; battery?: number; status?: string; [k: string]: unknown }

/**
 * Renderer-side facade over IPC to the main-process Cortex client.
 */
export class EmotivCortexService {
  async configure(options: { url?: string }): Promise<{ ok: boolean; url: string }> {
    return window.ra.cortex.configure(options)
  }

  async connectToCortex(): Promise<{ ok: boolean; error?: string }> {
    return window.ra.cortex.connect()
  }

  /** Lightweight check that EMOTIV Launcher / Cortex is reachable (does not require headset). */
  async testCortex(url?: string): Promise<{ ok: boolean; error?: string; connected?: boolean; hasToken?: boolean }> {
    return window.ra.cortex.test(url)
  }

  async testInsightPipeline(a: {
    url?: string
    clientId: string
    clientSecret: string
    headsetId: string
    streams: string[]
  }): Promise<{ ok: true; sessionId: string; headsets: unknown } | { ok: false; error: string }> {
    return window.ra.cortex.insightTest(a)
  }

  async requestAccess(): Promise<unknown> {
    return window.ra.cortex.requestAccess()
  }

  async authenticate(clientId: string, clientSecret: string, license?: string): Promise<unknown> {
    return window.ra.cortex.authorize(clientId, clientSecret, license)
  }

  async queryHeadsets(): Promise<HeadsetRow[]> {
    const r = await window.ra.cortex.queryHeadsets()
    if (Array.isArray(r)) {
      return r as HeadsetRow[]
    }
    if (r && typeof r === 'object' && Array.isArray((r as { headsets?: HeadsetRow[] }).headsets)) {
      return (r as { headsets: HeadsetRow[] }).headsets
    }
    return (r as HeadsetRow[]) ?? []
  }

  async getState() {
    return window.ra.cortex.getState()
  }

  async connectHeadset(id: string): Promise<unknown> {
    return window.ra.cortex.controlDevice({ command: 'connect', headset: id })
  }

  async createSession(headset: string): Promise<string> {
    return window.ra.cortex.createSession(headset)
  }

  async subscribeToStreams(session: string, streams: string[]): Promise<unknown> {
    return window.ra.cortex.subscribe(streams, session)
  }

  async unsubscribe(streams: string[], session?: string): Promise<unknown> {
    return window.ra.cortex.unsubscribe(streams, session)
  }

  async closeSession(): Promise<unknown> {
    return window.ra.cortex.closeSession()
  }

  onStream(cb: (snap: EmotivStreamSnapshot, raw: unknown) => void): () => void {
    return window.ra.onCortexPush((ev) => {
      if (!ev || typeof ev !== 'object') {
        return
      }
      const e = ev as { type?: string; data?: { met?: object; pow?: object; eeg?: number[]; com?: object } }
      if (e.type === 'stream' && e.data) {
        const d = e.data as { met?: object; pow?: object; eeg?: number[]; com?: object; [k: string]: unknown }
        const snap: EmotivStreamSnapshot = {
          timestamp: new Date().toISOString(),
          met: d.met as EmotivStreamSnapshot['met'],
          pow: d.pow as EmotivStreamSnapshot['pow'],
          eeg: d.eeg,
          com: d.com as EmotivStreamSnapshot['com']
        }
        cb(snap, e.data)
      }
    })
  }

  onDisconnected(cb: () => void): () => void {
    return window.ra.onCortexPush((ev) => {
      if (ev && typeof ev === 'object' && (ev as { type?: string }).type === 'disconnected') {
        cb()
      }
    })
  }
}

export const emotivCortex = new EmotivCortexService()
