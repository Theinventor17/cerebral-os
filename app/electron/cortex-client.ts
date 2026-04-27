/**
 * JSON-RPC 2.0 over WebSocket client for EMOTIV Cortex.
 * @see https://emotiv.gitbook.io/cortex-api/ — method names/params may vary by Cortex version; we handle flexible responses.
 */
import { EventEmitter } from 'node:events'
import type { WebSocket as WS } from 'ws'
import { WebSocket as WsImpl } from 'ws'

type JsonRecord = Record<string, unknown>

export type CortexEvent =
  | { type: 'stream'; stream: string; data: unknown }
  | { type: 'log'; line: string }
  | { type: 'session_event'; name: string; data: unknown }

export interface CortexClientOptions {
  url?: string
  onLog?: (m: string) => void
}

export class EmotivCortexClient extends EventEmitter {
  private url: string
  private ws: WS | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer?: NodeJS.Timeout }>()
  private onLog: (m: string) => void
  public cortexToken: string | null = null
  public sessionId: string | null = null
  public headsetId: string | null = null

  constructor(options: CortexClientOptions = {}) {
    super()
    this.url = options.url ?? 'wss://localhost:6868'
    this.onLog = options.onLog ?? (() => undefined)
  }

  setUrl(url: string): void {
    this.url = url
  }

  get connected(): boolean {
    return this.ws != null && this.ws.readyState === 1
  }

  private log(m: string): void {
    this.onLog(m)
  }

  connectToCortex(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === 1) {
        resolve()
        return
      }
      const socket = new WsImpl(this.url) as unknown as WS
      this.ws = socket
      const fail = (err: Error) => {
        this.log(`Cortex connect error: ${err.message}`)
        reject(err)
      }
      socket.on('error', (e: Error) => fail(e))
      socket.on('open', () => {
        this.log('Cortex WebSocket open')
        resolve()
      })
      socket.on('message', (data: { toString(): string }) => {
        this.handleMessage(data.toString())
      })
      socket.on('close', () => {
        this.log('Cortex WebSocket closed')
        this.emit('disconnected', {})
        this.cortexToken = null
        this.sessionId = null
      })
    })
  }

  private handleMessage(raw: string): void {
    let msg: JsonRecord
    try {
      msg = JSON.parse(raw) as JsonRecord
    } catch {
      this.log(`Non-JSON from Cortex: ${raw.slice(0, 200)}`)
      return
    }
    if (msg.jsonrpc === '2.0' && msg.id != null) {
      const id = Number(msg.id)
      const p = this.pending.get(id)
      if (p) {
        clearTimeout(p.timer)
        this.pending.delete(id)
        if (msg.error) {
          const e = (msg.error as { message?: string; code?: number }).message ?? JSON.stringify(msg.error)
          p.reject(new Error(e))
        } else p.resolve(msg.result)
      }
      return
    }
    if (
      (msg as { sid?: unknown }).sid != null ||
      (msg as { eeg?: unknown }).eeg != null ||
      (msg as { met?: unknown }).met != null ||
      (msg as { pow?: unknown }).pow != null ||
      (msg as { com?: unknown }).com != null ||
      (msg as { dev?: unknown }).dev != null
    ) {
      const any = msg as { stream?: string; sid?: string }
      const stream = any.stream ?? 'sub'
      this.emitCortex('stream', { stream, data: msg })
      return
    }
    this.emitCortex('session_event', { name: 'message', data: msg })
  }

  private emitCortex(
    t: 'stream' | 'log' | 'session_event' | (string & {}),
    payload: { stream?: string; data?: unknown; line?: string; name?: string }
  ): void {
    this.emit('cortex', { type: t, ...payload } as CortexEvent)
  }

  private async rpc<T = unknown>(method: string, params: JsonRecord = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('Cortex WebSocket not connected')
    }
    const id = this.nextId++
    const body = { jsonrpc: '2.0', method, params, id }
    this.log(`→ ${method}`)
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Cortex timeout: ${method}`))
      }, 20000)
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer
      })
      this.ws!.send(JSON.stringify(body))
    })
  }

  async requestAccess(): Promise<unknown> {
    return this.rpc('requestAccess', {})
  }

  async authenticate(clientId: string, clientSecret: string, license = ''): Promise<unknown> {
    const r = (await this.rpc<Record<string, string>>('authorize', {
      clientId,
      clientSecret,
      license: license || undefined,
      debit: 1
    })) as {
      cortexToken?: string
      token?: string
    }
    this.cortexToken = r.cortexToken ?? r.token ?? null
    this.log('authorize: token received ' + (this.cortexToken ? 'yes' : 'no'))
    return r
  }

  /** Alias for spec naming */
  async authorize(clientId: string, clientSecret: string, license?: string): Promise<unknown> {
    return this.authenticate(clientId, clientSecret, license ?? '')
  }

  async queryHeadsets(): Promise<unknown> {
    return this.rpc('queryHeadsets', { cortexToken: this.cortexToken! })
  }

  async controlDevice(args: { command: 'connect' | 'disconnect'; headset: string; ep?: string }): Promise<unknown> {
    return this.rpc('controlDevice', { command: args.command, headset: args.headset, ep: args.ep } as JsonRecord)
  }

  async createSession(headset: string, status: string = 'active'): Promise<string> {
    const r = (await this.rpc<unknown>('createSession', {
      cortexToken: this.cortexToken!,
      headset,
      status
    })) as unknown
    let id: string | undefined
    if (typeof r === 'string') {
      id = r
    } else if (r && typeof r === 'object') {
      const o = r as { id?: string; sessionId?: string; result?: { id?: string } }
      id = o.id ?? o.sessionId ?? o.result?.id
    }
    this.sessionId = id ?? this.sessionId
    this.headsetId = headset
    if (!this.sessionId) {
      this.log('createSession: no session id in result ' + JSON.stringify(r))
    }
    return this.sessionId ?? ''
  }

  async subscribeToStreams(streams: string[], sessionId?: string): Promise<unknown> {
    const sid = sessionId ?? this.sessionId
    if (!sid) {
      throw new Error('No Cortex session; createSession first')
    }
    return this.rpc('subscribe', { cortexToken: this.cortexToken!, session: sid, streams } as JsonRecord)
  }

  async unsubscribeFromStreams(streams: string[], sessionId?: string): Promise<unknown> {
    const sid = sessionId ?? this.sessionId
    if (!sid) {
      throw new Error('No Cortex session')
    }
    return this.rpc('unsubscribe', { cortexToken: this.cortexToken!, session: sid, streams } as JsonRecord)
  }

  async closeSession(sessionId?: string): Promise<unknown> {
    const sid = sessionId ?? this.sessionId
    if (!sid) {
      return {}
    }
    const r = await this.rpc('updateSession', { cortexToken: this.cortexToken!, session: sid, status: 'close' } as JsonRecord)
    this.sessionId = null
    return r
  }

  /** Some API versions use closeSession instead of updateSession */
  async closeSessionAlt(sessionId?: string): Promise<unknown> {
    const sid = sessionId ?? this.sessionId
    if (!sid) {
      return {}
    }
    try {
      return await this.rpc('closeSession', { cortexToken: this.cortexToken!, session: sid } as JsonRecord)
    } catch {
      return this.updateSession(sid, 'close')
    }
  }

  async updateSession(session: string, status: string): Promise<unknown> {
    return this.rpc('updateSession', { cortexToken: this.cortexToken!, session, status } as JsonRecord)
  }

  /**
   * Tear down the WebSocket. `ws` emits an `error` if closed while still CONNECTING
   * (abortHandshake); the listener must be present or Node treats it as uncaught.
   */
  closeSocket(): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error('Cortex client closed'))
    }
    this.pending.clear()

    const w = this.ws
    if (!w) {
      return
    }
    this.ws = null
    const noop = (): void => {
      // swallow handshake-abort / teardown errors from `ws` when not fully open
    }
    w.removeAllListeners()
    w.on('error', noop)
    try {
      w.close(1000, 'Cortex client shutdown')
    } catch {
      try {
        w.terminate()
      } catch {
        // ignore
      }
    }
  }
}
