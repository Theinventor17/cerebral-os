import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type {
  AgentMessage,
  AgentSession,
  ComposerWorkflowMode,
  ResonantAgent,
  SessionMode,
  ThoughtCommandName,
  ThoughtCommandStatus
} from '../types'
import { rowToAgent, rowToSession, rowToThought } from '../services/mappers'
import { AgentMemoryService } from '../services/AgentMemoryService'
import { AgentPermissionService } from '../services/AgentPermissionService'
import { AgentRuntimeService } from '../services/AgentRuntimeService'
import { ThoughtCommandRouter } from '../services/ThoughtCommandRouter'
import { localLLM } from '@/services/localLLM/LocalLLMService'
import { loadLocalLLMConfig } from '@/services/localLLM/LocalLLMService'
import { emotivCortex } from '@/services/EmotivCortexService'
import { DEFAULT_SESSION_TITLE } from '../services/sessionTitle'
import {
  EmotivInsightAdapter,
  EMOTIV_INSIGHT_PROFILE,
  buildInsightFeatureSnapshot,
  type IntentV1Result,
  type NormalizedEEGFrame
} from '@/cerebral/headsets'
import type { WorkspaceAction } from '@/cerebral/workspace/WorkspaceTypes'

const CMDS: ThoughtCommandName[] = [
  'focus_agent',
  'send_message',
  'ask_question',
  'request_output',
  'switch_agent',
  'confirm_intent',
  'reject_intent',
  'end_link'
]

function allIdleThoughts(): Record<ThoughtCommandName, ThoughtCommandStatus> {
  const o = {} as Record<ThoughtCommandName, ThoughtCommandStatus>
  for (const c of CMDS) {
    o[c] = 'idle'
  }
  return o
}

type Ctx = {
  agents: ResonantAgent[]
  activeAgent: ResonantAgent | null
  setActiveAgentId: (id: string) => void
  sessionId: string | null
  sessionMode: SessionMode
  setSessionMode: (m: SessionMode) => void
  demoMode: boolean
  setDemoMode: (v: boolean) => void
  localOnly: boolean
  setLocalOnly: (v: boolean) => void
  /** When true, reasoning deltas are merged into the assistant message (OpenAI-style / OpenRouter). */
  showReasoningStream: boolean
  setShowReasoningStream: (v: boolean) => Promise<void>
  autoListen: boolean
  setAutoListen: (v: boolean) => void
  messages: AgentMessage[]
  refresh: () => Promise<void>
  startSession: () => Promise<string | null>
  endSession: () => Promise<void>
  /** All conversations (newest first). */
  conversations: AgentSession[]
  refreshConversations: () => Promise<void>
  /** Open a past or current conversation and load its messages. */
  openConversation: (sessionId: string) => Promise<void>
  /** Sets the conversation title and prevents auto-titling from overwriting it. */
  renameConversation: (sessionId: string, newTitle: string) => Promise<void>
  sendMessage: (
    t: string,
    input?: AgentMessage['inputSource'],
    opts?: { workflow?: ComposerWorkflowMode }
  ) => Promise<void>
  /** @deprecated Live text is shown on the assistant row with `status: 'streaming'`; kept as null for compatibility. */
  streamDraft: string | null
  /** Abort the in-flight provider stream (partial reply remains). */
  cancelActiveGeneration: () => void
  /** Markdown fence exports to `.cerebral/exports/...` while tokens stream. */
  streamSavedFiles: string[]
  /** After the reply finishes, absolute paths of files written to the real workspace (tools / fences). */
  lastWorkspaceWrites: string[]
  completeGuide: (
    userText: string,
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ) => Promise<string>
  sending: boolean
  sendError: string | null
  memory: Awaited<ReturnType<typeof AgentMemoryService.list>>
  openRouterEnabled: boolean
  lmStudioUp: boolean | null
  ollamaLabel: string
  cortex: { label: string; ok: boolean | null }
  headset: string
  /** True only when a recent EMOTIV Insight / Cortex stream produced a real normalized frame (no fabrication). */
  headsetLive: boolean
  /** Alias for the same live gate; prefer for Thought mode checks. */
  insightLive: boolean
  thoughtIntent: IntentV1Result | null
  battery: string
  thoughtStatuses: Record<ThoughtCommandName, ThoughtCommandStatus>
  setThoughtStatus: (c: ThoughtCommandName, s: ThoughtCommandStatus) => void
  /** Display string: numeric % only when a real value exists; else use empty / — in UI. */
  signalLock: number | null
  eegLine: string
  /**
   * Latest normalized Cortex/Insight frame (updated on each stream event). For 3D viz / useFrame: read
   * `current` and avoid React state. Null when no frame yet.
   */
  eegVizFrameRef: MutableRefObject<NormalizedEEGFrame | null>
  timeLabel: string
  permissionModal: { open: boolean; message: string }
  openShellGate: () => void
  closeShellGate: () => void
  resolveShellGate: (ok: boolean) => void
  /** One-off UX hint, e.g. non-streaming provider or first-token wait. */
  streamHint: string | null
  clearStreamHint: () => void
  runTestStreamingPrompt: () => void
  /** Model proposed workspace actions; cleared after send or when resolved. */
  pendingWorkspace: { sessionId: string; assistantMessageId: string; actions: WorkspaceAction[] } | null
  clearPendingWorkspace: () => void
  updatePendingWorkspaceActions: (actions: WorkspaceAction[]) => void
}

const ResonantContext = createContext<Ctx | null>(null)

export function ResonantAgentsProvider({ children }: { children: ReactNode }): ReactNode {
  const [agents, setAgents] = useState<ResonantAgent[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionMode, setSessionModeState] = useState<SessionMode>('manual')
  const [demoMode, setDemoModeState] = useState(false)
  const [localOnly, setLocalOnlyState] = useState(false)
  const [showReasoningStream, setShowReasoningStreamState] = useState(false)
  const [autoListen, setAutoListenState] = useState(true)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const streamIdRef = useRef<string | null>(null)
  const pendingStreamingMessageRef = useRef<AgentMessage | null>(null)
  const [streamHint, setStreamHint] = useState<string | null>(null)
  const [pendingWorkspace, setPendingWorkspace] = useState<{
    sessionId: string
    assistantMessageId: string
    actions: WorkspaceAction[]
  } | null>(null)
  const [streamSavedFiles, setStreamSavedFiles] = useState<string[]>([])
  const [lastWorkspaceWrites, setLastWorkspaceWrites] = useState<string[]>([])
  const [conversations, setConversations] = useState<AgentSession[]>([])
  const [memory, setMemory] = useState<Awaited<ReturnType<typeof AgentMemoryService.list>>>([])
  const [openRouterEnabled, setOpenRouterEnabled] = useState(false)
  const [lmStudioUp, setLmStudioUp] = useState<boolean | null>(null)
  const [ollamaText, setOllamaText] = useState('Ollama —')
  const [cortexLabel, setCortexLabel] = useState('EMOTIV Cortex')
  const [cortexOk, setCortexOk] = useState<boolean | null>(null)
  const [headsetName, setHeadsetName] = useState('—')
  const [battery, setBattery] = useState('—')
  const [t0] = useState(() => Date.now())
  const [timeLabel, setTimeLabel] = useState('00:00:00')
  const [thoughtStatuses, setThoughtStatuses] = useState<Record<ThoughtCommandName, ThoughtCommandStatus>>(allIdleThoughts)
  const [sigLock, setSigLock] = useState<number | null>(null)
  const [eegLine, setEegLine] = useState('No live signal')
  const eegVizFrameRef = useRef<NormalizedEEGFrame | null>(null)
  const [insightLive, setInsightLive] = useState(false)
  const [thoughtIntent, setThoughtIntent] = useState<IntentV1Result | null>(null)
  const [shellGate, setShellGate] = useState({ open: false, message: '' })
  const frameBufferRef = useRef<NormalizedEEGFrame[]>([])
  const lastFrameAtRef = useRef(0)
  const prevInsightFeatRef = useRef<ReturnType<typeof buildInsightFeatureSnapshot> | null>(null)
  const lastIntentLogRef = useRef(0)

  const applyThoughtRows = useCallback((rows: Array<Record<string, unknown>>) => {
    const next = allIdleThoughts()
    const seen = new Set<ThoughtCommandName>()
    for (const r of rows) {
      const t = rowToThought(r)
      if (seen.has(t.command)) {
        continue
      }
      seen.add(t.command)
      next[t.command] = t.status
    }
    setThoughtStatuses(next)
  }, [])

  const loadAgents = useCallback(async () => {
    await AgentRuntimeService.ensureInit()
    const s = await AgentRuntimeService.loadSettings()
    setLocalOnlyState(s.localOnly)
    setShowReasoningStreamState(!!s.showReasoningStream)
    setAutoListenState(s.autoListen)
    setDemoModeState(s.demoMode)
    if (s.sessionMode) {
      setSessionModeState(s.sessionMode)
    }
    const prows = (await window.ra.provider.list()) as Array<Record<string, unknown>>
    setOpenRouterEnabled(
      prows.some(
        (p) => String(p.type) === 'openrouter' && Number(p.enabled) === 1 && !s.localOnly
      )
    )
    const arows = (await window.ra.agent.list()) as Array<Record<string, unknown>>
    setAgents(arows.map(rowToAgent))
  }, [])

  const syncSessionFromDb = useCallback(async () => {
    await AgentRuntimeService.dedupeOpenSessionsKeepNewest()
    const sessions = await AgentRuntimeService.listSessions()
    setConversations(sessions)
    const open = sessions.find((x) => !x.endedAt)
    if (open) {
      setSessionId(open.id)
      setMessages(await AgentRuntimeService.listMessages(open.id))
    } else {
      setSessionId(null)
      setMessages([])
    }
  }, [])

  const refreshConversations = useCallback(async () => {
    setConversations(await AgentRuntimeService.listSessions())
  }, [])

  const cancelActiveGeneration = useCallback(() => {
    const id = streamIdRef.current
    if (id) {
      void window.ra.chat.cancelStream(id)
    }
  }, [])

  const clearStreamHint = useCallback(() => {
    setStreamHint(null)
  }, [])

  const clearPendingWorkspace = useCallback(() => {
    setPendingWorkspace(null)
  }, [])

  const updatePendingWorkspaceActions = useCallback((actions: WorkspaceAction[]) => {
    setPendingWorkspace((prev) => {
      if (!prev) {
        return null
      }
      if (actions.length === 0) {
        return null
      }
      return { ...prev, actions }
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ra?.chat.onAiChatStreamChunk) {
      return
    }
    const unsubscribe = window.ra.chat.onAiChatStreamChunk((p) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[renderer stream] chunk streamId=', p.streamId, 'len=', p.chunk?.length ?? 0)
      }
      if (p.chunk) {
        setStreamHint((h) => (h && h.startsWith('Waiting for first token') ? null : h))
      }
      setMessages((prev) => {
        const id = p.streamId
        const match = (m: AgentMessage) => m.id === id || m.streamId === id
        if (!prev.some(match)) {
          const base = pendingStreamingMessageRef.current
          if (base && (base.id === id || base.streamId === id)) {
            return [...prev, { ...base, content: p.chunk, status: 'streaming' as const }]
          }
          return prev
        }
        return prev.map((m) =>
          match(m) ? { ...m, content: (m.content || '') + p.chunk, status: 'streaming' as const } : m
        )
      })
    })
    return () => {
      void unsubscribe()
    }
  }, [])

  const initLayout = useCallback(async () => {
    await loadAgents()
    const s = await AgentRuntimeService.loadSettings()
    if (s.cortexUrl) {
      await emotivCortex.configure({ url: s.cortexUrl })
    }
    if (!s.sessionMode) {
      setSessionModeState('manual')
      await window.ra.settings.set({ sessionMode: 'manual' })
    }
    await syncSessionFromDb()
  }, [loadAgents, syncSessionFromDb])

  const refreshMemory = useCallback(async () => {
    const m = await AgentMemoryService.list(activeId ?? undefined)
    setMemory(m)
  }, [activeId])

  useEffect(() => {
    void initLayout()
  }, [initLayout])

  useEffect(() => {
    void refreshMemory()
  }, [refreshMemory])

  useEffect(() => {
    const t = window.setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000)
      setTimeLabel(
        `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
      )
    }, 1000)
    return () => window.clearInterval(t)
  }, [t0])

  useEffect(() => {
    return emotivCortex.onStream((_, raw) => {
      const frame = EmotivInsightAdapter.normalizeFrame(raw)
      if (frame) {
        eegVizFrameRef.current = frame
        const buf = frameBufferRef.current
        buf.push(frame)
        if (buf.length > 50) {
          buf.splice(0, buf.length - 50)
        }
        lastFrameAtRef.current = Date.now()
        if (frame.signalQuality != null) {
          setSigLock(frame.signalQuality)
        } else {
          const met = (frame.raw as { met?: { cq?: number } } | undefined)?.met
          if (met && typeof met.cq === 'number' && !Number.isNaN(met.cq)) {
            setSigLock(met.cq > 1 ? met.cq / 100 : met.cq)
          }
        }
        const p = frame.metrics
        if (p?.focus != null) {
          setEegLine(
            `Insight · f ${p.focus.toFixed(2)}` +
              (p.stress != null ? ` · s ${p.stress.toFixed(2)}` : '') +
              (p.relaxation != null ? ` · r ${p.relaxation.toFixed(2)}` : '')
          )
        } else if (frame.channels) {
          setEegLine('Insight · EEG')
        } else {
          setEegLine('Insight · stream')
        }
      }
    })
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => {
      const live = Date.now() - lastFrameAtRef.current < 5000
      setInsightLive(live)
      if (!live) {
        if (lastFrameAtRef.current > 0) {
          setEegLine('No live signal')
          setSigLock(null)
        }
      }
    }, 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!autoListen) {
      return
    }
    const id = window.setInterval(() => {
      if (!sessionId) {
        return
      }
      if (!insightLive) {
        return
      }
      const now = Date.now()
      if (now - lastIntentLogRef.current < 900) {
        return
      }
      const buf = frameBufferRef.current
      if (buf.length < 1) {
        return
      }
      const last = buf[buf.length - 1]
      const prev = prevInsightFeatRef.current
      const tail = buf.slice(-25)
      const intent = EmotivInsightAdapter.mapIntentV1(last, tail, prev)
      setThoughtIntent(intent)
      if (intent.command && intent.confidence >= 0.4 && intent.source !== 'none') {
        lastIntentLogRef.current = now
        const mJson = intent.metricsForStorage != null ? JSON.stringify(intent.metricsForStorage) : null
        void ThoughtCommandRouter.upsert(
          sessionId,
          intent.command,
          'detected',
          intent.confidence,
          undefined,
          mJson
        )
      }
      prevInsightFeatRef.current = buildInsightFeatureSnapshot(tail, EMOTIV_INSIGHT_PROFILE)
    }, 1000)
    return () => window.clearInterval(id)
  }, [autoListen, sessionId, insightLive])

  useEffect(() => {
    const tick = () =>
      void (async () => {
        const s = await AgentRuntimeService.loadSettings()
        if (s.cortexUrl) {
          await emotivCortex.configure({ url: s.cortexUrl })
        }
        const cfg = await localLLM.test()
        if (cfg.ok) {
          const c = await loadLocalLLMConfig()
          setOllamaText(`Ollama · ${c.model}`)
        } else {
          setOllamaText('Ollama offline')
        }
        const pr = (await window.ra.provider.list()) as Array<Record<string, unknown>>
        const lm = pr.find((p) => String(p.type) === 'lmstudio' && Number(p.enabled) === 1) as { id: string } | undefined
        if (lm) {
          const t = (await window.ra.provider.test(lm.id)) as { ok: boolean }
          setLmStudioUp(!!t.ok)
        } else {
          setLmStudioUp(null)
        }
        const st = await emotivCortex.testCortex(s.cortexUrl)
        setCortexOk(st.ok)
        setCortexLabel('EMOTIV Cortex')
        try {
          const hs = await emotivCortex.queryHeadsets()
          if (Array.isArray(hs) && hs.length > 0) {
            const h = hs[0] as { battery?: number; id?: string; [k: string]: unknown }
            setHeadsetName(h.id != null ? String(h.id) : s.emotivHeadsetId || 'Insight')
            if (h.battery != null && !Number.isNaN(Number(h.battery))) {
              setBattery(`${Math.round(Number(h.battery))}%`)
            } else {
              setBattery('—')
            }
            if (lastFrameAtRef.current === 0) {
              setEegLine('Cortex ok — no stream data yet (run Test Insight in Headsets settings)')
            }
          } else {
            setHeadsetName(s.emotivHeadsetId || '—')
            setBattery('—')
            if (lastFrameAtRef.current === 0) {
              setEegLine('No headset in Cortex list')
            }
          }
        } catch {
          setHeadsetName(s.emotivHeadsetId || '—')
          setBattery('—')
          if (lastFrameAtRef.current === 0) {
            setEegLine('Cortex not authorized or offline')
          }
        }
      })()
    tick()
    const i = window.setInterval(tick, 15000)
    return () => window.clearInterval(i)
  }, [])

  const setLocalOnly = useCallback(
    async (v: boolean) => {
      setLocalOnlyState(v)
      await window.ra.settings.set({ localOnly: v })
      await loadAgents()
    },
    [loadAgents]
  )

  const setShowReasoningStream = useCallback(async (v: boolean) => {
    setShowReasoningStreamState(v)
    await window.ra.settings.set({ showReasoningStream: v })
  }, [])

  const setAutoListen = useCallback(async (v: boolean) => {
    setAutoListenState(v)
    await window.ra.settings.set({ autoListen: v })
  }, [])

  const activeAgent = useMemo(
    () => (agents.length ? agents.find((a) => a.id === (activeId ?? agents[0].id)) ?? agents[0] : null),
    [agents, activeId]
  )

  const setSessionMode = useCallback(
    async (m: SessionMode) => {
      setSessionModeState(m)
      await window.ra.settings.set({ sessionMode: m })
      if (sessionId) {
        const row = (await window.ra.session.get(sessionId)) as Record<string, unknown> | null
        if (row) {
          const rs = rowToSession(row)
          await window.ra.session.upsert({
            id: sessionId,
            title: rs.title,
            active_agent_id: (activeAgent?.id ?? rs.activeAgentId) as string,
            mode: m,
            signal_lock_score: sigLock,
            neural_link_status: insightLive ? 'connected' : 'disconnected',
            started_at: rs.startedAt,
            ended_at: rs.endedAt != null ? rs.endedAt : null,
            summary: rs.summary != null ? rs.summary : null,
            title_locked: rs.titleLocked ? 1 : 0
          })
        }
      }
    },
    [sessionId, activeAgent?.id, sigLock, insightLive]
  )

  const setDemoMode = useCallback(async (v: boolean) => {
    setDemoModeState(v)
    await window.ra.settings.set({ demoMode: v })
  }, [])

  useEffect(() => {
    if (agents.length && !activeId) {
      setActiveId(agents[0].id)
    }
  }, [agents, activeId])

  useEffect(() => {
    if (!sessionId) {
      setThoughtStatuses(allIdleThoughts())
      return
    }
    void (async () => {
      const rows = (await ThoughtCommandRouter.listForSession(sessionId)) as Array<Record<string, unknown>>
      applyThoughtRows(rows)
    })()
  }, [sessionId, applyThoughtRows])

  const refresh = useCallback(async () => {
    const arows = (await window.ra.agent.list()) as Array<Record<string, unknown>>
    setAgents(arows.map(rowToAgent))
    if (sessionId) {
      setMessages(await AgentRuntimeService.listMessages(sessionId))
    }
    await refreshConversations()
    await refreshMemory()
  }, [sessionId, refreshMemory, refreshConversations])

  const startSession = useCallback(async (): Promise<string | null> => {
    if (!activeAgent) {
      return null
    }
    const id = await AgentRuntimeService.startSession(DEFAULT_SESSION_TITLE, activeAgent, sessionMode)
    setSessionId(id)
    setMessages(await AgentRuntimeService.listMessages(id))
    setThoughtStatuses(allIdleThoughts())
    await refreshConversations()
    return id
  }, [activeAgent, sessionMode, refreshConversations])

  const renameConversation = useCallback(async (id: string, newTitle: string) => {
    await AgentRuntimeService.renameSession(id, newTitle)
    await refreshConversations()
  }, [refreshConversations])

  const openConversation = useCallback(
    async (targetId: string) => {
      if (sending) {
        return
      }
      setSendError(null)
      try {
        await AgentRuntimeService.activateSession(targetId)
        setSessionId(targetId)
        setMessages(await AgentRuntimeService.listMessages(targetId))
        const raw = (await window.ra.session.get(targetId)) as Record<string, unknown> | null
        if (raw) {
          setActiveId(rowToSession(raw).activeAgentId)
        }
        setThoughtStatuses(allIdleThoughts())
        const rows = (await ThoughtCommandRouter.listForSession(targetId)) as Array<Record<string, unknown>>
        applyThoughtRows(rows)
        await refreshConversations()
      } catch (e) {
        setSendError((e as Error).message)
      }
    },
    [sending, applyThoughtRows, refreshConversations]
  )

  const endSession = useCallback(async () => {
    if (!sessionId) {
      return
    }
    await AgentRuntimeService.endSession(sessionId, 'Session ended from dashboard.')
    setSessionId(null)
    setMessages([])
    setThoughtStatuses(allIdleThoughts())
    await refreshConversations()
  }, [sessionId, refreshConversations])

  const sendMessage = useCallback(
    async (
      text: string,
      input: AgentMessage['inputSource'] = 'manual',
      opts?: { workflow?: ComposerWorkflowMode }
    ) => {
      const trimmed = text.trim()
      if (!trimmed || !activeAgent) {
        return
      }
      if (sessionMode === 'thought' && !insightLive) {
        setSendError('Thought mode needs a live EMOTIV Insight signal. Switch to Manual or Hybrid, or connect Insight in settings.')
        return
      }
      if (sessionMode === 'hybrid' && !insightLive) {
        // continue as manual — no error
      }
      setSending(true)
      setSendError(null)
      setStreamHint(null)
      setPendingWorkspace(null)
      streamIdRef.current = null
      pendingStreamingMessageRef.current = null
      setStreamSavedFiles([])
      setLastWorkspaceWrites([])
      let sid = sessionId
      if (!sid) {
        const id = await startSession()
        if (!id) {
          setStreamSavedFiles([])
          setLastWorkspaceWrites([])
          setSending(false)
          return
        }
        sid = id
        setSessionId(id)
      }
      const hist = messages.map((m) => {
        if (m.role === 'assistant') {
          return { role: 'assistant' as const, content: m.content }
        }
        return { role: 'user' as const, content: m.content }
      })
      try {
        await AgentRuntimeService.appendUserMessage(sid, activeAgent, trimmed, input)
        setMessages(await AgentRuntimeService.listMessages(sid))
        await refreshConversations()
        const streamOut = await AgentRuntimeService.sendChatStream(
          sid,
          activeAgent,
          trimmed,
          input,
          hist,
          {
            workflow: opts?.workflow,
            onStreamingAssistant: (m) => {
              streamIdRef.current = m.id
              pendingStreamingMessageRef.current = m
              setMessages((prev) => [...prev, m])
            }
          },
          undefined,
          (path) => {
            setStreamSavedFiles((f) => [...f, path])
          }
        )
        if (streamOut.bufferedResponse) {
          setStreamHint(
            streamOut.usedNonStreamFallback
              ? 'Provider returned buffered response (non-streaming fallback after no visible stream text).'
              : 'Provider returned non-streaming response (full text at end).'
          )
        }
        if (streamOut.pendingWorkspaceActions && streamOut.pendingWorkspaceActions.length > 0) {
          setPendingWorkspace({
            sessionId: sid,
            assistantMessageId: streamOut.streamId,
            actions: streamOut.pendingWorkspaceActions
          })
        } else {
          setPendingWorkspace(null)
        }
        streamIdRef.current = null
        pendingStreamingMessageRef.current = null
        setLastWorkspaceWrites(streamOut.workspacePaths ?? [])
        setMessages(await AgentRuntimeService.listMessages(sid))
        await refreshConversations()
        await refreshMemory()
      } catch (e) {
        streamIdRef.current = null
        pendingStreamingMessageRef.current = null
        setSendError((e as Error).message)
        setStreamSavedFiles([])
        setLastWorkspaceWrites([])
        try {
          setMessages(await AgentRuntimeService.listMessages(sid))
        } catch {
          // ignore
        }
      } finally {
        setSending(false)
      }
    },
    [
      activeAgent,
      sessionId,
      messages,
      startSession,
      sessionMode,
      insightLive,
      refreshMemory,
      refreshConversations
    ]
  )

  const runTestStreamingPrompt = useCallback(() => {
    void sendMessage('Count from 1 to 20, one number per line.', 'manual', undefined)
  }, [sendMessage])

  const completeGuide = useCallback(
    async (
      userText: string,
      history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    ) => {
      return AgentRuntimeService.sendGuide(userText, history)
    },
    []
  )

  const setActiveAgentId = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const setThoughtStatus = useCallback((c: ThoughtCommandName, s: ThoughtCommandStatus) => {
    setThoughtStatuses((p) => ({ ...p, [c]: s }))
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      agents,
      activeAgent,
      setActiveAgentId,
      sessionId,
      sessionMode,
      setSessionMode,
      demoMode,
      setDemoMode,
      localOnly,
      setLocalOnly,
      showReasoningStream,
      setShowReasoningStream,
      autoListen,
      setAutoListen,
      messages,
      refresh,
      startSession,
      endSession,
      conversations,
      refreshConversations,
      openConversation,
      renameConversation,
      sendMessage,
      completeGuide,
      sending,
      sendError,
      streamDraft: null as string | null,
      cancelActiveGeneration,
      streamSavedFiles,
      lastWorkspaceWrites,
      memory,
      openRouterEnabled,
      lmStudioUp,
      ollamaLabel: ollamaText,
      cortex: { label: cortexLabel, ok: cortexOk },
      headset: headsetName,
      headsetLive: insightLive,
      insightLive,
      thoughtIntent,
      battery,
      thoughtStatuses,
      setThoughtStatus,
      signalLock: sigLock,
      eegLine,
      eegVizFrameRef,
      timeLabel,
      streamHint,
      clearStreamHint,
      runTestStreamingPrompt,
      pendingWorkspace,
      clearPendingWorkspace,
      updatePendingWorkspaceActions,
      permissionModal: { open: shellGate.open, message: shellGate.message },
      openShellGate: () => setShellGate({ open: true, message: 'Shell tool not enabled in this build.' }),
      closeShellGate: () => setShellGate({ open: false, message: '' }),
      resolveShellGate: (ok) => {
        if (sessionId && activeAgent) {
          void (async () => {
            const raw = (await window.ra.session.get(sessionId)) as Record<string, unknown> | null
            if (raw) {
              await AgentPermissionService.recordGateEvent(
                rowToSession(raw),
                activeAgent.id,
                'shell',
                ok ? 'approved' : 'blocked',
                'Shell tool not enabled in this build.'
              )
            }
          })()
        }
        setShellGate({ open: false, message: '' })
      }
    }),
    [
      agents,
      activeAgent,
      sessionId,
      sessionMode,
      demoMode,
      localOnly,
      showReasoningStream,
      setShowReasoningStream,
      autoListen,
      messages,
      refresh,
      startSession,
      endSession,
      conversations,
      refreshConversations,
      openConversation,
      renameConversation,
      sendMessage,
      completeGuide,
      sending,
      sendError,
      streamHint,
      clearStreamHint,
      runTestStreamingPrompt,
      pendingWorkspace,
      clearPendingWorkspace,
      updatePendingWorkspaceActions,
      cancelActiveGeneration,
      streamSavedFiles,
      lastWorkspaceWrites,
      memory,
      openRouterEnabled,
      lmStudioUp,
      ollamaText,
      cortexLabel,
      cortexOk,
      headsetName,
      insightLive,
      thoughtIntent,
      battery,
      thoughtStatuses,
      sigLock,
      eegLine,
      timeLabel,
      shellGate
    ]
  )

  return <ResonantContext.Provider value={value}>{children}</ResonantContext.Provider>
}

export function useResonantAgents() {
  const c = useContext(ResonantContext)
  if (!c) {
    throw new Error('useResonantAgents requires provider')
  }
  return c
}

export { CMDS }
