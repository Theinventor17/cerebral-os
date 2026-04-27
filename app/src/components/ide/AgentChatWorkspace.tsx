import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useResonantAgents } from '../../providers/ResonantAgentsProvider'
import { useCommandExecution } from '../../providers/CommandExecutionProvider'
import { useNeuralThoughtOptional } from '../../providers/NeuralThoughtProvider'
import { ConversationListRow } from '../ConversationListRow'
import { agentToRow } from '../../services/mappers'
import { AgentProviderService } from '../../services/AgentProviderService'
import { formatSessionListTime } from '../../services/sessionTitle'
import type { AgentMessage, AgentSession, ComposerWorkflowMode, ModelProviderConfig, ResonantAgent, SessionMode } from '../../types'
import { ComposerAssistantBody } from './composer/ComposerAssistantBody'
import { NeuralAlphabetPanel } from '@/cerebral/neural-alphabet/NeuralAlphabetPanel'
import { useCerebralLayout } from '@/cerebral/context/CerebralTabContext'
import { WorkspaceApprovalPanel } from '@/cerebral/workspace/WorkspaceApprovalPanel'
import { executeApprovedWorkspaceActions } from '@/cerebral/workspace/WorkspaceService'
import {
  CEREBRAL_EXECUTE_BROWSER_TAB_ID,
  EXECUTE_LIVE_BROWSER_DEFAULT_URL
} from '@/cerebral/workspace/executeBrowserConstants'
import { toWorkspaceRelPath } from './composer/proseFormat'

const suggestions = ['Decompose tasks', 'Prioritize', 'Review risk', 'Outline next steps']

const WF_STORAGE = 'cerebral.composer.workflow.v1'

const WORKFLOWS: {
  id: ComposerWorkflowMode
  label: string
  hint: string
}[] = [
  { id: 'vibe', label: 'Vibe', hint: 'Coding & implementation' },
  { id: 'imagine', label: 'Imagine', hint: 'Content, create & mix' },
  { id: 'execute', label: 'Execute', hint: 'Actions & get it done' }
]

function loadWorkflow(): ComposerWorkflowMode {
  try {
    const v = localStorage.getItem(WF_STORAGE)
    if (v === 'vibe' || v === 'imagine' || v === 'execute') {
      return v
    }
  } catch {
    // ignore
  }
  return 'vibe'
}

const DEMO_FORGE_CHAT: AgentMessage[] = [
  {
    id: 'demo-f-1',
    sessionId: 'demo',
    role: 'assistant',
    inputSource: 'manual',
    content:
      'I can help you **build, automate, and engineer**. Try `npm run dev` to run the app, or open `http://localhost:5173/` if the dev server is up.\n\n- Manual / Hybrid: type here\n- Thought: optional with headset',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString()
  }
]

function formatMsgTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function AgentChatWorkspace(): ReactNode {
  const { dispatchOutgoing } = useCommandExecution()
  const {
    activeAgent,
    messages,
    sending,
    sendError,
    streamHint,
    clearStreamHint,
    runTestStreamingPrompt,
    streamSavedFiles,
    cancelActiveGeneration,
    lastWorkspaceWrites,
    sessionMode,
    endSession,
    startSession,
    sessionId,
    conversations,
    openConversation,
    renameConversation,
    demoMode,
    insightLive,
    refresh,
    pendingWorkspace,
    clearPendingWorkspace,
    updatePendingWorkspaceActions
  } = useResonantAgents()
  const { openTab, updateTab, workspaceRoot, tabs, setActiveTabId, activeTabId, hasHydrated } = useCerebralLayout()
  const [workspaceApprovalBusy, setWorkspaceApprovalBusy] = useState(false)
  const onOpenWorkspaceFile = useCallback(
    (relPath: string) => {
      const norm = relPath.replace(/\\/g, '/')
      const ex = tabs.find(
        (x) => x.type === 'code' && String(x.data?.['path'] ?? '').replace(/\\/g, '/') === norm
      )
      if (ex) {
        setActiveTabId(ex.id)
        return
      }
      const title = norm.split('/').pop() || norm
      openTab({
        id: `cosf:${encodeURIComponent(norm)}`,
        title,
        type: 'code',
        data: { path: norm }
      })
    },
    [openTab, setActiveTabId, tabs]
  )

  const [input, setInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [workflow, setWorkflow] = useState<ComposerWorkflowMode>(loadWorkflow)

  const ensureExecuteLiveBrowserTab = useCallback(() => {
    if (!hasHydrated || !activeAgent) {
      return
    }
    const hasExecuteBrowser = tabs.some(
      (x) => x.type === 'browser' && String(x.data?.['liveBrowser'] ?? '') === 'execute'
    )
    if (hasExecuteBrowser) {
      return
    }
    const active = activeTabId ? tabs.find((x) => x.id === activeTabId) : undefined
    const insertAfter =
      active?.type === 'agent_chat'
        ? active.id
        : tabs.find((x) => x.type === 'agent_chat' && String(x.data?.['agentId'] ?? '') === activeAgent.id)?.id ??
          activeTabId ??
          null
    openTab(
      {
        id: CEREBRAL_EXECUTE_BROWSER_TAB_ID,
        title: 'Live browser',
        type: 'browser',
        data: { url: EXECUTE_LIVE_BROWSER_DEFAULT_URL, liveBrowser: 'execute' }
      },
      { activate: false, insertAfterTabId: insertAfter }
    )
  }, [hasHydrated, activeAgent, tabs, openTab, activeTabId])

  const onOpenUrlInBrowser = useCallback(
    (url: string) => {
      if (!hasHydrated) {
        return
      }
      let title = 'Live browser'
      try {
        const h = new URL(url).hostname
        if (h) {
          title = h
        }
      } catch {
        // keep
      }
      const existing = tabs.find((t) => t.id === CEREBRAL_EXECUTE_BROWSER_TAB_ID)
      if (existing) {
        updateTab(CEREBRAL_EXECUTE_BROWSER_TAB_ID, {
          data: { ...existing.data, url, liveBrowser: 'execute' },
          title
        })
        setActiveTabId(CEREBRAL_EXECUTE_BROWSER_TAB_ID)
        return
      }
      const active = activeTabId ? tabs.find((x) => x.id === activeTabId) : undefined
      const insertAfter =
        active?.type === 'agent_chat'
          ? active.id
          : (activeAgent &&
              tabs.find((x) => x.type === 'agent_chat' && String(x.data?.['agentId'] ?? '') === activeAgent.id)?.id) ??
            activeTabId ??
            null
      openTab(
        {
          id: CEREBRAL_EXECUTE_BROWSER_TAB_ID,
          title,
          type: 'browser',
          data: { url, liveBrowser: 'execute' }
        },
        { activate: true, insertAfterTabId: insertAfter }
      )
    },
    [hasHydrated, tabs, activeTabId, activeAgent, updateTab, openTab, setActiveTabId]
  )

  const onWorkspaceApproveAll = useCallback(async () => {
    if (!pendingWorkspace || !activeAgent || pendingWorkspace.sessionId !== sessionId) {
      return
    }
    setWorkspaceApprovalBusy(true)
    try {
      await executeApprovedWorkspaceActions(pendingWorkspace.actions, {
        sessionId: pendingWorkspace.sessionId,
        activeAgent,
        onOpenFile: onOpenWorkspaceFile,
        onOpenUrlInBrowser: onOpenUrlInBrowser
      })
      clearPendingWorkspace()
      void refresh()
    } finally {
      setWorkspaceApprovalBusy(false)
    }
  }, [pendingWorkspace, activeAgent, sessionId, onOpenWorkspaceFile, onOpenUrlInBrowser, clearPendingWorkspace, refresh])

  const onWorkspaceReject = useCallback(() => {
    clearPendingWorkspace()
  }, [clearPendingWorkspace])

  const onWorkspaceApproveOne = useCallback(
    async (index: number) => {
      if (!pendingWorkspace || !activeAgent || pendingWorkspace.sessionId !== sessionId) {
        return
      }
      const act = pendingWorkspace.actions[index]
      if (!act) {
        return
      }
      setWorkspaceApprovalBusy(true)
      try {
        await executeApprovedWorkspaceActions([act], {
          sessionId: pendingWorkspace.sessionId,
          activeAgent,
          onOpenFile: onOpenWorkspaceFile,
          onOpenUrlInBrowser: onOpenUrlInBrowser
        })
        const next = pendingWorkspace.actions.filter((_, j) => j !== index)
        updatePendingWorkspaceActions(next)
        void refresh()
      } finally {
        setWorkspaceApprovalBusy(false)
      }
    },
    [pendingWorkspace, activeAgent, sessionId, onOpenWorkspaceFile, onOpenUrlInBrowser, updatePendingWorkspaceActions, refresh]
  )

  const onWorkflowChange = useCallback(
    (w: ComposerWorkflowMode) => {
      setWorkflow(w)
      if (w === 'execute') {
        ensureExecuteLiveBrowserTab()
      }
    },
    [ensureExecuteLiveBrowserTab]
  )

  useEffect(() => {
    if (workflow !== 'execute') {
      return
    }
    ensureExecuteLiveBrowserTab()
  }, [workflow, ensureExecuteLiveBrowserTab])

  useEffect(() => {
    try {
      localStorage.setItem(WF_STORAGE, workflow)
      window.dispatchEvent(new CustomEvent('cerebral:workflow'))
    } catch {
      // ignore
    }
  }, [workflow])

  useEffect(() => {
    if (!menuOpen) {
      return
    }
    const onDoc = () => setMenuOpen(false)
    const t = window.setTimeout(() => {
      document.addEventListener('click', onDoc)
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', onDoc)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!historyOpen) {
      return
    }
    const onDoc = () => setHistoryOpen(false)
    const t = window.setTimeout(() => {
      document.addEventListener('click', onDoc)
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', onDoc)
    }
  }, [historyOpen])

  const displayMessages = useMemo(() => {
    if (messages.length > 0) {
      return messages
    }
    if (demoMode && activeAgent && activeAgent.name.toLowerCase().includes('forge')) {
      return DEMO_FORGE_CHAT
    }
    return []
  }, [messages, activeAgent, demoMode])

  const thoughtBlocked = sessionMode === 'thought' && !insightLive

  const [firstTokenSlowNotice, setFirstTokenSlowNotice] = useState(false)
  const lastAsst = displayMessages[displayMessages.length - 1]
  const isStreamingNoText =
    sending &&
    lastAsst?.role === 'assistant' &&
    lastAsst?.status === 'streaming' &&
    !String(lastAsst?.content ?? '').trim()

  useEffect(() => {
    if (!isStreamingNoText) {
      setFirstTokenSlowNotice(false)
      return
    }
    const t = window.setTimeout(() => setFirstTokenSlowNotice(true), 8000)
    return () => window.clearTimeout(t)
  }, [isStreamingNoText])

  const onSend = useCallback(async () => {
    const t = input.trim()
    if (!t || thoughtBlocked) {
      return
    }
    setInput('')
    await dispatchOutgoing(t, 'manual', { workflow })
  }, [input, dispatchOutgoing, thoughtBlocked, workflow])

  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollNearBottomRef = useRef(true)
  const scrollToMessagesEnd = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      scrollNearBottomRef.current = dist < 96
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!scrollNearBottomRef.current) {
      return
    }
    scrollToMessagesEnd()
  }, [messages, sending, scrollToMessagesEnd])

  if (!activeAgent) {
    return (
      <div className="ccomp-root">
        <p className="ccomp-empty">Open a chat from the Explorer to use Composer with your model provider.</p>
      </div>
    )
  }

  const wfLabel = WORKFLOWS.find((w) => w.id === workflow)?.label ?? 'Vibe'

  return (
    <div className="ccomp-root">
      <ChatHeader
        modeLabel={wfLabel}
        modelName={activeAgent.modelName}
        sessionId={sessionId}
        conversations={conversations}
        historyOpen={historyOpen}
        onHistoryOpenChange={setHistoryOpen}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        onNewChat={() => void startSession()}
        onSelectConversation={(id) => {
          setHistoryOpen(false)
          void openConversation(id)
        }}
        onRenameConversation={renameConversation}
        onEndSession={() => void endSession()}
      />

      <div className="ccomp-main">
        {(sessionMode === 'thought' || sessionMode === 'hybrid') && insightLive && (
          <div style={{ padding: '0 12px 8px' }}>
            <NeuralAlphabetPanel />
          </div>
        )}
        <div className="ccomp-scroll" ref={scrollRef}>
          {displayMessages.map((m) => (
            <MessageRow
              key={m.id}
              m={m}
              modelLabel={activeAgent.modelName}
              workflow={workflow}
              workspaceRoot={workspaceRoot}
              onOpenWorkspaceFile={onOpenWorkspaceFile}
            />
          ))}
          {sessionId &&
            pendingWorkspace &&
            pendingWorkspace.sessionId === sessionId &&
            pendingWorkspace.actions.length > 0 && (
              <div style={{ padding: '0 12px' }}>
                <WorkspaceApprovalPanel
                  actions={pendingWorkspace.actions}
                  busy={workspaceApprovalBusy}
                  onApproveAll={onWorkspaceApproveAll}
                  onReject={onWorkspaceReject}
                  onApproveOne={onWorkspaceApproveOne}
                />
              </div>
            )}
          {sending && streamSavedFiles.length > 0 && (
            <div className="ccomp-msg ccomp-msg--asst ccomp-msg--streaming" aria-live="polite">
              <div className="ccomp-asst-head">
                <span className="ccomp-badge">{activeAgent.modelName}</span>
                <span className="ccomp-time">exporting…</span>
              </div>
              <div className="ccomp-stream-files" title="Stream export; click to open if under the workspace">
                {streamSavedFiles.map((p) => {
                  const rel = toWorkspaceRelPath(p, workspaceRoot)
                  if (rel) {
                    return (
                      <button
                        type="button"
                        key={p}
                        className="ccomp-stream-file ccomp-stream-file--btn"
                        onClick={() => onOpenWorkspaceFile(rel)}
                      >
                        {p.replace(/^.*[/\\]/, '')}
                      </button>
                    )
                  }
                  return (
                    <div key={p} className="ccomp-stream-file">
                      {p}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {displayMessages.length === 0 && !sending && (
            <p className="ccomp-hint">
              {demoMode
                ? 'Send a message. With Demo mode you may see a Forge sample reply.'
                : 'Plan, ask, or run commands. Works in Manual or Hybrid without a headset.'}
            </p>
          )}
          {thoughtBlocked && (
            <p className="ccomp-err">
              Thought mode needs a live EMOTIV Insight signal (Headsets activity ◎ in the left bar). Use Manual or Hybrid without hardware.
            </p>
          )}
          {sendError && <p className="ccomp-err">{sendError}</p>}
          {streamHint && (
            <p className="ccomp-hint" role="status">
              {streamHint}
              <button
                type="button"
                className="ccomp-linkish"
                style={{ marginLeft: 8 }}
                onClick={() => clearStreamHint()}
              >
                Dismiss
              </button>
            </p>
          )}
          {firstTokenSlowNotice && isStreamingNoText && (
            <p className="ccomp-hint" role="status">
              Waiting for first token from provider…
            </p>
          )}
          {workflow === 'execute' && (
            <p className="ccomp-hint" style={{ marginTop: 8 }}>
              <strong>Live browser</strong> is a tab next to your chat. Approve a run like{' '}
              <code style={{ fontSize: 11, fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>
                start https://…
              </code>{' '}
              to open that URL in the built-in webview (not the system browser).
            </p>
          )}
        </div>
      </div>

      <div className="ccomp-suggest">
        {suggestions.map((s) => (
          <button key={s} type="button" className="ccomp-suggest-btn" onClick={() => setInput(s)}>
            {s}
          </button>
        ))}
        <button
          type="button"
          className="ccomp-suggest-btn ccomp-suggest-btn--test"
          title="Sends: Count 1–20, one per line. Watch for live chunks."
          onClick={() => runTestStreamingPrompt()}
        >
          Test streaming
        </button>
      </div>

      {lastWorkspaceWrites.length > 0 && (
        <div className="ccomp-last-writes" role="status" aria-label="Files written in the last reply">
          <span className="ccomp-last-writes-label">Workspace</span>
          {lastWorkspaceWrites.map((p) => {
            const rel = toWorkspaceRelPath(p, workspaceRoot)
            if (rel) {
              return (
                <button
                  type="button"
                  key={p}
                  className="ccomp-write-tag ccomp-write-tag--open"
                  title={p}
                  onClick={() => onOpenWorkspaceFile(rel)}
                >
                  {p.replace(/^.*[/\\]/, '')}
                </button>
              )
            }
            return (
              <code key={p} className="ccomp-write-tag" title={p}>
                {p.replace(/^.*[/\\]/, '')}
              </code>
            )
          })}
        </div>
      )}

      <ComposerInput
        value={input}
        onChange={setInput}
        sending={sending}
        onStopGeneration={cancelActiveGeneration}
        thoughtBlocked={thoughtBlocked}
        sessionMode={sessionMode}
        insightLive={insightLive}
        activeAgent={activeAgent}
        refresh={refresh}
        workflow={workflow}
        onWorkflowChange={onWorkflowChange}
        onSend={onSend}
        onScrollMessagesToEnd={scrollToMessagesEnd}
      />
    </div>
  )
}

function MessageRow({
  m,
  modelLabel,
  workflow,
  workspaceRoot,
  onOpenWorkspaceFile
}: {
  m: AgentMessage
  modelLabel: string
  workflow: ComposerWorkflowMode
  workspaceRoot: string | null
  onOpenWorkspaceFile: (relPath: string) => void
}): ReactNode {
  const isUser = m.role !== 'assistant'
  if (isUser) {
    return (
      <div className="ccomp-msg ccomp-msg--user">
        {m.inputSource === 'thought' && <span className="ccomp-user-src">via thought</span>}
        <div className="ccomp-user-pill">{m.content}</div>
        <time className="ccomp-time" dateTime={m.createdAt}>
          {formatMsgTime(m.createdAt)}
        </time>
      </div>
    )
  }
  const streaming = m.status === 'streaming'
  const failed = m.status === 'failed'
  const cancelled = m.status === 'cancelled'
  return (
    <div className={`ccomp-msg ccomp-msg--asst${streaming ? ' ccomp-msg--streaming' : ''}`}>
      <div className="ccomp-asst-head">
        <span className="ccomp-badge">{modelLabel}</span>
        {streaming ? (
          <span className="ccomp-time">
            {String(m.content ?? '').trim().length > 0 ? 'streaming…' : 'typing…'}
          </span>
        ) : (
          <time className="ccomp-time" dateTime={m.createdAt}>
            {formatMsgTime(m.createdAt)}
          </time>
        )}
        {(failed || cancelled) && (
          <span className="ccomp-time" title={m.errorText}>
            {failed ? 'failed' : 'stopped'}
          </span>
        )}
        <button type="button" className="ccomp-msg-menu" title="Message actions" aria-label="Message actions">
          ···
        </button>
      </div>
      <div className="ccomp-asst-body">
        <ComposerAssistantBody
          content={m.content}
          workflow={workflow}
          workspaceRoot={workspaceRoot}
          onOpenWorkspaceFile={onOpenWorkspaceFile}
        />
        {failed && m.errorText ? <p className="ccomp-err">{m.errorText}</p> : null}
      </div>
    </div>
  )
}

function ChatHeader({
  modeLabel,
  modelName,
  sessionId,
  conversations,
  historyOpen,
  onHistoryOpenChange,
  menuOpen,
  onMenuOpenChange,
  onNewChat,
  onSelectConversation,
  onRenameConversation,
  onEndSession
}: {
  modeLabel: string
  modelName: string
  sessionId: string | null
  conversations: AgentSession[]
  historyOpen: boolean
  onHistoryOpenChange: (v: boolean) => void
  menuOpen: boolean
  onMenuOpenChange: (v: boolean) => void
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onRenameConversation: (sessionId: string, newTitle: string) => void | Promise<void>
  onEndSession: () => void
}): ReactNode {
  return (
    <header className="ccomp-head">
      <h1 className="ccomp-title" title="Composer — mode and model control how the model responds.">
        Composer
        <span className="ccomp-title-sub">
          {' '}
          — {modeLabel} · {modelName}
        </span>
      </h1>
      <div className="ccomp-head-actions">
        <div className="ccomp-menu-wrap">
          <button
            type="button"
            className="ccomp-icon-btn"
            title="Conversation history"
            aria-expanded={historyOpen}
            aria-label="Conversation history"
            onClick={(e) => {
              e.stopPropagation()
              onMenuOpenChange(false)
              onHistoryOpenChange(!historyOpen)
            }}
          >
            ≡
          </button>
          {historyOpen && (
            <div
              className="ccomp-history-pop"
              role="listbox"
              aria-label="Conversations"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ccomp-history-top">
                <span className="ccomp-history-title">Conversations</span>
                <button
                  type="button"
                  className="ccomp-history-new"
                  onClick={() => {
                    onNewChat()
                    onHistoryOpenChange(false)
                  }}
                >
                  New
                </button>
              </div>
              <ul className="ccomp-history-list">
                {conversations.length === 0 ? (
                  <li className="ccomp-history-empty">No conversations yet. Send a message or start a new chat.</li>
                ) : (
                  conversations.map((c) => {
                    const isCurrent = c.id === sessionId
                    return (
                      <li key={c.id} className="ccomp-history-list-item">
                        <ConversationListRow
                          c={c}
                          isCurrent={isCurrent}
                          onSelect={() => onSelectConversation(c.id)}
                          onRename={onRenameConversation}
                          className={isCurrent ? 'ccomp-history-item ccomp-history-item--active' : 'ccomp-history-item'}
                          timeLabel=""
                          subLabel={`${formatSessionListTime(c.startedAt)}${c.endedAt ? ' · Ended' : ' · Active'}`}
                          variant="composer"
                          stacked
                        />
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          )}
        </div>
        <button type="button" className="ccomp-icon-btn" title="New chat" aria-label="New chat" onClick={onNewChat}>
          +
        </button>
        <div className="ccomp-menu-wrap">
          <button
            type="button"
            className="ccomp-icon-btn"
            title="More"
            aria-expanded={menuOpen}
            aria-label="Open menu"
            onClick={(e) => {
              e.stopPropagation()
              onHistoryOpenChange(false)
              onMenuOpenChange(!menuOpen)
            }}
          >
            ···
          </button>
          {menuOpen && (
            <div
              className="ccomp-dropdown"
              role="menu"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onEndSession()
                  onMenuOpenChange(false)
                }}
              >
                End session
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function ComposerInput({
  value,
  onChange,
  sending,
  onStopGeneration,
  thoughtBlocked,
  sessionMode,
  insightLive,
  activeAgent,
  refresh,
  workflow,
  onWorkflowChange,
  onSend,
  onScrollMessagesToEnd
}: {
  value: string
  onChange: (s: string) => void
  sending: boolean
  onStopGeneration: () => void
  thoughtBlocked: boolean
  sessionMode: SessionMode
  insightLive: boolean
  activeAgent: ResonantAgent
  refresh: () => Promise<void>
  workflow: ComposerWorkflowMode
  onWorkflowChange: (w: ComposerWorkflowMode) => void
  onSend: () => void
  onScrollMessagesToEnd: () => void
}): ReactNode {
  const [wfOpen, setWfOpen] = useState(false)
  const [provOpen, setProvOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [providerList, setProviderList] = useState<ModelProviderConfig[]>([])
  const [provLoading, setProvLoading] = useState(false)
  const [provError, setProvError] = useState<string | null>(null)
  const [modelList, setModelList] = useState<Array<{ id: string; name: string }>>([])
  const [modelLoading, setModelLoading] = useState(false)
  const [ctxCount, setCtxCount] = useState(0)
  const [modelError, setModelError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const neuro = useNeuralThoughtOptional()

  const closeWf = useCallback(() => setWfOpen(false), [])
  const closeProv = useCallback(() => setProvOpen(false), [])
  const closeModel = useCallback(() => setModelOpen(false), [])

  const [providerLabel, setProviderLabel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const p = await AgentProviderService.get(activeAgent.providerId)
      if (cancelled) {
        return
      }
      setProviderLabel(p?.name ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [activeAgent.providerId])

  useEffect(() => {
    if (!wfOpen) {
      return
    }
    const onDoc = () => closeWf()
    const t = window.setTimeout(() => {
      document.addEventListener('click', onDoc)
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', onDoc)
    }
  }, [wfOpen, closeWf])

  useEffect(() => {
    if (!modelOpen) {
      return
    }
    const onDoc = () => closeModel()
    const t = window.setTimeout(() => {
      document.addEventListener('click', onDoc)
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', onDoc)
    }
  }, [modelOpen, closeModel])

  useEffect(() => {
    if (!provOpen) {
      return
    }
    const onDoc = () => closeProv()
    const t = window.setTimeout(() => {
      document.addEventListener('click', onDoc)
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', onDoc)
    }
  }, [provOpen, closeProv])

  useEffect(() => {
    if (!provOpen) {
      return
    }
    let cancelled = false
    setProvLoading(true)
    setProvError(null)
    void (async () => {
      try {
        const list = await AgentProviderService.list()
        if (cancelled) {
          return
        }
        const enabled = list.filter((p) => p.enabled)
        setProviderList(enabled.length > 0 ? enabled : list)
        if (enabled.length === 0 && list.length > 0) {
          setProvError('No enabled providers. Turn on a provider in Model providers settings.')
        }
      } catch (e) {
        if (!cancelled) {
          setProvError((e as Error).message)
          setProviderList([])
        }
      } finally {
        if (!cancelled) {
          setProvLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [provOpen])

  useEffect(() => {
    if (!modelOpen) {
      return
    }
    let cancelled = false
    setModelLoading(true)
    setModelError(null)
    void (async () => {
      const r = await window.ra.provider.models(activeAgent.providerId)
      if (cancelled) {
        return
      }
      if (r.ok && r.models && r.models.length > 0) {
        setModelList(r.models)
        setModelError(r.error ?? null)
      } else {
        setModelList([{ id: activeAgent.modelName, name: activeAgent.modelName }])
        setModelError(r.error ?? 'Using current model. Add or refresh the provider to load more models.')
      }
      setModelLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [modelOpen, activeAgent.providerId, activeAgent.modelName])

  const applyModel = useCallback(
    async (modelId: string) => {
      if (modelId === activeAgent.modelName) {
        setModelOpen(false)
        return
      }
      const next: ResonantAgent = {
        ...activeAgent,
        modelName: modelId,
        updatedAt: new Date().toISOString()
      }
      await window.ra.agent.upsert(agentToRow(next))
      await refresh()
      setModelOpen(false)
    },
    [activeAgent, refresh]
  )

  const applyProvider = useCallback(
    async (providerId: string) => {
      if (providerId === activeAgent.providerId) {
        setProvOpen(false)
        return
      }
      const p = providerList.find((x) => x.id === providerId)
      if (!p) {
        setProvOpen(false)
        return
      }
      const next: ResonantAgent = {
        ...activeAgent,
        providerId,
        modelName: p.modelName || 'default',
        updatedAt: new Date().toISOString()
      }
      await window.ra.agent.upsert(agentToRow(next))
      await refresh()
      setProvOpen(false)
    },
    [activeAgent, providerList, refresh]
  )

  const onPickFiles = useCallback(
    (fl: FileList | null) => {
      if (!fl?.length) {
        return
      }
      const names = Array.from(fl)
        .map((f) => f.name)
        .filter(Boolean)
      if (!names.length) {
        return
      }
      setCtxCount((c) => c + names.length)
      const line = `Context: ${names.join(', ')}`
      onChange(value ? `${value}\n\n${line}\n` : `${line}\n`)
    },
    [onChange, value]
  )

  const onVoice = useCallback(() => {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => {
        continuous: boolean
        lang: string
        onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
        start: () => void
      }
    }
    const Ctor = w.webkitSpeechRecognition
    if (!Ctor) {
      onChange(value ? `${value} ` : '')
      if (textAreaRef.current) {
        textAreaRef.current.focus()
      }
      return
    }
    const rec = new Ctor()
    rec.continuous = false
    rec.lang = (navigator as { userLanguage?: string }).userLanguage || navigator.language || 'en-US'
    rec.onresult = (e) => {
      const first = e.results[0] as { 0: { transcript: string } }
      const t = first[0].transcript?.trim()
      if (t) {
        onChange(value ? `${value} ${t}` : t)
      }
    }
    rec.start()
  }, [onChange, value])

  const wfMeta = WORKFLOWS.find((w) => w.id === workflow) ?? WORKFLOWS[0]
  const displayProvider = providerLabel || 'Provider'
  const displayModel = activeAgent.modelName || 'Model'

  const ph =
    thoughtBlocked
      ? 'Switch to Manual or Hybrid to type…'
      : sessionMode === 'thought'
        ? 'Type with headset…'
        : 'Plan, @ for context, / for commands'

  return (
    <div className="ccomp-composer">
      <input
        ref={fileInputRef}
        type="file"
        className="ccomp-file"
        multiple
        tabIndex={-1}
        onChange={(e) => {
          onPickFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <div className="ccomp-composer-top">
        <button
          type="button"
          className="ccomp-ctx-pill"
          title="Attach files to your prompt (not model output). Paths are inserted into the message."
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="ccomp-ctx-ico">&gt;</span> Context {ctxCount} {ctxCount === 1 ? 'file' : 'files'}
        </button>
        <div className="ccomp-composer-review">
          <button
            type="button"
            className="ccomp-linkish"
            title="Clear the composer text"
            onClick={() => onChange('')}
          >
            Undo all
          </button>
          <button
            type="button"
            className="ccomp-linkish"
            title="Focus composer (keep draft)"
            onClick={() => textAreaRef.current?.focus()}
          >
            Keep all
          </button>
          <button type="button" className="ccomp-linkish" title="Scroll to latest messages" onClick={onScrollMessagesToEnd}>
            Review
          </button>
        </div>
      </div>
      <textarea
        ref={textAreaRef}
        className="ccomp-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        disabled={thoughtBlocked}
        rows={3}
        onKeyDown={(e) => {
          if (
            insightLive &&
            neuro &&
            neuro.candidates.length > 0 &&
            (sessionMode === 'thought' || sessionMode === 'hybrid') &&
            /^[1-5]$/.test(e.key)
          ) {
            e.preventDefault()
            neuro.confirmNumber(Number(e.key))
            return
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!sending) {
              void onSend()
            }
          }
        }}
      />
      <div className="ccomp-composer-btm">
        <div className="ccomp-composer-btm-l">
          <div className="ccomp-menu-wrap ccomp-wf-wrap">
            <button
              type="button"
              className="ccomp-pill-btn ccomp-pill-btn--workflow"
              title={`Mode — ${wfMeta.hint} (steers the model for this session)`}
              aria-haspopup="listbox"
              aria-expanded={wfOpen}
              aria-label="Mode"
              onClick={(e) => {
                e.stopPropagation()
                setModelOpen(false)
                setProvOpen(false)
                setWfOpen((o) => !o)
              }}
            >
              {wfMeta.label}
              <span className="ccomp-caret">▾</span>
            </button>
            {wfOpen && (
              <div
                className="ccomp-dropdown ccomp-wf-dropdown"
                role="listbox"
                aria-label="Mode"
                onClick={(e) => e.stopPropagation()}
              >
                {WORKFLOWS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    role="option"
                    aria-selected={workflow === w.id}
                    className={workflow === w.id ? 'ccomp-wf-opt ccomp-wf-opt--on' : 'ccomp-wf-opt'}
                    onClick={() => {
                      onWorkflowChange(w.id)
                      setWfOpen(false)
                    }}
                  >
                    <span className="ccomp-wf-opt-title">{w.label}</span>
                    <span className="ccomp-wf-opt-hint">{w.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ccomp-menu-wrap ccomp-wf-wrap ccomp-mdl-wrap">
            <button
              type="button"
              className="ccomp-pill-btn ccomp-pill-btn--model"
              title="Model provider (OpenRouter, Ollama, …) — then pick a model"
              aria-haspopup="listbox"
              aria-expanded={provOpen}
              aria-label="Provider"
              onClick={(e) => {
                e.stopPropagation()
                setWfOpen(false)
                setModelOpen(false)
                setProvOpen((o) => !o)
              }}
            >
              {provLoading ? '…' : displayProvider}
              <span className="ccomp-caret">▾</span>
            </button>
            {provOpen && (
              <div
                className="ccomp-dropdown ccomp-wf-dropdown ccomp-mdl-dropdown"
                role="listbox"
                aria-label="Choose provider"
                onClick={(e) => e.stopPropagation()}
              >
                {provError && <div className="ccomp-mdl-note">{provError}</div>}
                {providerList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    className={
                      p.id === activeAgent.providerId ? 'ccomp-wf-opt ccomp-wf-opt--on' : 'ccomp-wf-opt'
                    }
                    onClick={() => void applyProvider(p.id)}
                  >
                    <span className="ccomp-wf-opt-title">{p.name}</span>
                    <span className="ccomp-wf-opt-hint">{p.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ccomp-menu-wrap ccomp-wf-wrap ccomp-mdl-wrap">
            <button
              type="button"
              className="ccomp-pill-btn ccomp-pill-btn--model"
              title="Model for this session (from the selected provider)"
              aria-haspopup="listbox"
              aria-expanded={modelOpen}
              aria-label="Model"
              onClick={(e) => {
                e.stopPropagation()
                setWfOpen(false)
                setProvOpen(false)
                setModelOpen((o) => !o)
              }}
            >
              {modelLoading ? '…' : displayModel}
              <span className="ccomp-caret">▾</span>
            </button>
            {modelOpen && (
              <div
                className="ccomp-dropdown ccomp-mdl-dropdown"
                role="listbox"
                aria-label="Choose model"
                onClick={(e) => e.stopPropagation()}
              >
                {modelError && <div className="ccomp-mdl-note">{modelError}</div>}
                {modelList.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    className={m.id === activeAgent.modelName ? 'ccomp-mdl-opt ccomp-mdl-opt--on' : 'ccomp-mdl-opt'}
                    onClick={() => void applyModel(m.id)}
                  >
                    <span className="ccomp-mdl-name">{m.name || m.id}</span>
                    <span className="ccomp-mdl-id">{m.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="ccomp-composer-btm-r">
          <span className="ccomp-ico-slot" title="Status" aria-hidden={!sending}>
            {sending ? <span className="ccomp-spinner" /> : null}
          </span>
          {sending ? (
            <button
              type="button"
              className="ccomp-stop-gen"
              title="Stop generation"
              onClick={() => onStopGeneration()}
            >
              Stop
            </button>
          ) : null}
          <button
            type="button"
            className="ccomp-ico-tool"
            title="Add files to context"
            onClick={() => fileInputRef.current?.click()}
          >
            ⧉
          </button>
          <button type="button" className="ccomp-ico-tool" title="Dictate (uses speech recognition when available)" onClick={onVoice}>
            ●
          </button>
          <button
            type="button"
            className="ccomp-send"
            disabled={sending || thoughtBlocked}
            title="Send"
            onClick={() => void onSend()}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
