import type { ReactNode, KeyboardEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_LINES = 4000

function formatPrompt(p: string): string {
  return p.replace(/\//g, '\\')
}

/** Empty or `'.'` means "use workspace / backend default" — do not run commands in process cwd. */
function isPlaceholderCwd(c: string | undefined | null): boolean {
  return c == null || c.trim() === '' || c === '.'
}

function newClientId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function defaultShellLabel(): string {
  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent)) {
    return 'powershell'
  }
  return 'bash'
}

function previewCmd(cmd: string, n: number): string {
  const t = cmd.replace(/\s+/g, ' ').trim()
  if (t.length <= n) {
    return t
  }
  return t.slice(0, n) + '…'
}

type Line = { t: 'out' | 'err' | 'sys' | 'prompt' | 'exok' | 'exbad'; s: string }

type TermSession = {
  clientId: string
  kind: 'user' | 'agent'
  title: string
  shellLabel: string
  cwd: string
  command: string
  lines: Line[]
  running: string | null
}

function appendToLines(lines: Line[], stream: 'stdout' | 'stderr', data: string): Line[] {
  const nextType: Line['t'] = stream === 'stderr' ? 'err' : 'out'
  const last = lines[lines.length - 1]
  if (last && last.t === nextType) {
    return [...lines.slice(0, -1), { t: nextType, s: last.s + data } as Line].slice(-MAX_LINES)
  }
  return [...lines, { t: nextType, s: data } as Line].slice(-MAX_LINES)
}

function makeUserSession(clientId: string, cwd: string, intro: boolean): TermSession {
  return {
    clientId,
    kind: 'user',
    title: defaultShellLabel(),
    shellLabel: defaultShellLabel(),
    cwd: cwd,
    command: '',
    lines: intro
      ? [
          {
            t: 'sys' as const,
            s: 'Enter runs command · ↑/↓ history · Ctrl+L clear · Ctrl+C cancel\n'
          }
        ]
      : [{ t: 'sys' as const, s: '' }],
    running: null
  }
}

function makeAgentSession(sessionId: string, command: string): TermSession {
  return {
    clientId: newClientId(),
    kind: 'agent',
    title: `Cerebral (${previewCmd(command, 40)})`,
    shellLabel: 'agent',
    cwd: '',
    command,
    lines: [],
    running: sessionId
  }
}

const AgentIcon = () => (
  <span className="cos-term-sico" title="Agent">
    <span className="cos-term-sinf" aria-hidden>
      ∞
    </span>
  </span>
)

function lineClass(t: Line['t']): string {
  if (t === 'err') {
    return 'cos-t-err'
  }
  if (t === 'out') {
    return 'cos-t-out'
  }
  if (t === 'prompt') {
    return 'cos-t-prompt'
  }
  if (t === 'exok') {
    return 'cos-t-ok'
  }
  if (t === 'exbad') {
    return 'cos-t-bad'
  }
  return 'cos-t-sys'
}

export function TerminalInteractive({
  workspaceRoot,
  clearTrigger,
  addUserSessionTrigger,
  bumpAddUser
}: {
  workspaceRoot: string | null
  clearTrigger?: number
  addUserSessionTrigger?: number
  bumpAddUser?: () => void
}): ReactNode {
  const id0 = useRef(newClientId())
  const [sessions, setSessions] = useState<TermSession[]>(() => [makeUserSession(id0.current, '', true)])
  const [activeId, setActiveId] = useState(id0.current)
  const [line, setLine] = useState('')
  const [internalBump, setInternalBump] = useState(0)
  const lineByTab = useRef<Record<string, string>>({})
  const hist = useRef<Record<string, string[]>>({})
  const histI = useRef<Record<string, number>>({})
  const backendToClient = useRef(new Map<string, string>())
  const activeIdRef = useRef(activeId)
  const outRef = useRef<HTMLDivElement>(null)
  const addUserPrev = useRef<number | null>(null)
  const internalAddPrev = useRef(0)
  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const doBumpAdd = useCallback(() => {
    if (bumpAddUser) {
      bumpAddUser()
    } else {
      setInternalBump((n) => n + 1)
    }
  }, [bumpAddUser])

  const active = sessions.find((s) => s.clientId === activeId) ?? sessions[0]!

  useEffect(() => {
    void (async () => {
      let p = ''
      const g = await window.cerebral.terminal.getCwd()
      if (g.path) {
        p = g.path
      } else if (workspaceRoot) {
        p = workspaceRoot
      } else {
        const w = await window.cerebral.workspace.default()
        p = w.rootPath || '.'
      }
      setSessions((prev) => {
        if (prev.length === 0) {
          return prev
        }
        const u = prev[0]!
        if (u.kind !== 'user') {
          return prev
        }
        // Do not clobber a path the user typed in the CWD field (only override placeholders).
        if (!isPlaceholderCwd(u.cwd)) {
          return prev
        }
        return prev.map((s, i) => (i === 0 && s.kind === 'user' ? { ...s, cwd: p } : s))
      })
    })()
  }, [workspaceRoot])

  const addUserSession = useCallback(() => {
    const cid = newClientId()
    setSessions((prev) => {
      const cwdFrom = prev.find((s) => s.clientId === activeIdRef.current)?.cwd
      return [...prev, makeUserSession(cid, cwdFrom || '', false)]
    })
    setActiveId(cid)
    setLine('')
  }, [])

  useEffect(() => {
    if (addUserSessionTrigger === undefined) {
      return
    }
    if (addUserPrev.current === null) {
      addUserPrev.current = addUserSessionTrigger
      return
    }
    if (addUserSessionTrigger === addUserPrev.current) {
      return
    }
    addUserPrev.current = addUserSessionTrigger
    addUserSession()
  }, [addUserSessionTrigger, addUserSession])

  useEffect(() => {
    if (internalBump === 0) {
      return
    }
    if (internalBump === internalAddPrev.current) {
      return
    }
    internalAddPrev.current = internalBump
    addUserSession()
  }, [internalBump, addUserSession])

  useEffect(() => {
    const u = window.cerebral.terminal.onChunk((c) => {
      let clientId = backendToClient.current.get(c.sessionId)
      if (!clientId) {
        if (c.source === 'agent') {
          const agent = makeAgentSession(c.sessionId, c.command)
          clientId = agent.clientId
          backendToClient.current.set(c.sessionId, clientId)
          setSessions((prev) => {
            if (prev.some((s) => s.clientId === clientId)) {
              return prev
            }
            return [...prev, agent]
          })
        } else {
          return
        }
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.clientId === clientId ? { ...s, lines: appendToLines(s.lines, c.stream, c.data) } : s
        )
      )
    })
    const x = window.cerebral.terminal.onExit((e) => {
      const foundId = backendToClient.current.get(e.sessionId)
      if (!foundId) {
        if (e.source === 'agent') {
          const a = makeAgentSession(e.sessionId, e.command)
          backendToClient.current.set(e.sessionId, a.clientId)
          let extra: Line
          if (e.cancelled) {
            extra = { t: 'exbad' as const, s: '[cancelled]\n' }
          } else if (e.code === 0) {
            extra = { t: 'exok' as const, s: '[exit 0]\n' }
          } else {
            extra = { t: 'exbad' as const, s: `[exit ${e.code ?? '—'}]\n` }
          }
          setSessions((prev) => {
            if (prev.some((s) => s.clientId === a.clientId)) {
              return prev.map((s) =>
                s.clientId === a.clientId
                  ? { ...s, running: null, lines: [...s.lines, extra].slice(-MAX_LINES) }
                  : s
              )
            }
            return [...prev, { ...a, running: null, lines: [extra] }]
          })
        }
        return
      }
      const clientId = foundId
      backendToClient.current.delete(e.sessionId)
      setSessions((prev) =>
        prev.map((s) => {
          if (s.clientId !== clientId) {
            return s
          }
          let extra: Line
          if (e.cancelled) {
            extra = { t: 'exbad' as const, s: '[cancelled]\n' }
          } else if (e.code === 0) {
            extra = { t: 'exok' as const, s: '[exit 0]\n' }
          } else {
            extra = { t: 'exbad' as const, s: `[exit ${e.code ?? '—'}]\n` }
          }
          return { ...s, running: null, lines: [...s.lines, extra].slice(-MAX_LINES) }
        })
      )
    })
    return () => {
      u()
      x()
    }
  }, [])

  const clearPrev = useRef<number | null>(null)
  useEffect(() => {
    if (clearTrigger === undefined) {
      return
    }
    if (clearPrev.current === null) {
      clearPrev.current = clearTrigger
      return
    }
    if (clearTrigger === clearPrev.current) {
      return
    }
    clearPrev.current = clearTrigger
    setSessions((prev) =>
      prev.map((s) => (s.clientId === activeId ? { ...s, lines: [{ t: 'sys' as const, s: '' }] } : s))
    )
  }, [clearTrigger, activeId])

  useEffect(() => {
    outRef.current?.scrollTo(0, outRef.current.scrollHeight)
  }, [active?.lines, activeId])

  const runLine = useCallback(
    async (t: string) => {
      const raw = t.trim()
      if (!raw) {
        return
      }
      const s = sessions.find((x) => x.clientId === activeId)
      if (!s || s.kind !== 'user' || s.running) {
        return
      }
      const list = (hist.current[s.clientId] ?? []).filter((h) => h !== raw)
      list.push(raw)
      hist.current[s.clientId] = list.slice(-80)
      histI.current[s.clientId] = list.length
      let c = s.cwd
      if (isPlaceholderCwd(c)) {
        const g = await window.cerebral.terminal.getCwd()
        c = g.path || (await window.cerebral.workspace.default()).rootPath || '.'
        setSessions((prev) =>
          prev.map((x) => (x.clientId === s.clientId && isPlaceholderCwd(x.cwd) ? { ...x, cwd: c } : x))
        )
      }
      const shell = s.shellLabel
      const p =
        typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent) && shell === 'powershell'
          ? `PS ${formatPrompt(c)}>`
          : `cerebral ${formatPrompt(c)}>`
      setSessions((prev) =>
        prev.map((x) =>
          x.clientId === s.clientId
            ? { ...x, lines: [...x.lines, { t: 'prompt' as const, s: `${p} ${raw}\n` }].slice(-MAX_LINES) }
            : x
        )
      )
      setLine('')
      setSessions((prev) => prev.map((x) => (x.clientId === s.clientId ? { ...x, running: 'pending' } : x)))
      const res = await window.cerebral.terminal.start({
        workspaceId: 'default',
        cwd: c,
        command: raw,
        source: 'manual'
      })
      if (res.blocked) {
        setSessions((prev) =>
          prev.map((x) =>
            x.clientId === s.clientId
              ? {
                  ...x,
                  running: null,
                  lines: [...x.lines, { t: 'err' as const, s: `[BLOCKED] ${res.blocked}\n` }].slice(-MAX_LINES)
                }
              : x
          )
        )
        return
      }
      if (res.sessionId) {
        backendToClient.current.set(res.sessionId, s.clientId)
        setSessions((prev) =>
          prev.map((x) => (x.clientId === s.clientId ? { ...x, running: res.sessionId } : x))
        )
      } else {
        setSessions((prev) => prev.map((x) => (x.clientId === s.clientId ? { ...x, running: null } : x)))
      }
    },
    [activeId, sessions]
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const s = sessions.find((x) => x.clientId === activeId)
      if (!s || s.kind !== 'user') {
        return
      }
      if (e.key === 'Enter') {
        if (s.running) {
          return
        }
        void runLine(line)
        return
      }
      if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault()
        if (s.running && s.running !== 'pending') {
          void window.cerebral.terminal.cancel(s.running)
        }
        return
      }
      if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault()
        setSessions((prev) =>
          prev.map((x) => (x.clientId === s.clientId ? { ...x, lines: [{ t: 'sys' as const, s: '' }] } : x))
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const h = hist.current[s.clientId] ?? []
        if (h.length === 0) {
          return
        }
        const i = (histI.current[s.clientId] ?? h.length) - 1
        histI.current[s.clientId] = Math.max(0, i)
        setLine(h[histI.current[s.clientId]!] ?? '')
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const h = hist.current[s.clientId] ?? []
        histI.current[s.clientId] = Math.min(h.length, (histI.current[s.clientId] ?? 0) + 1)
        setLine(h[histI.current[s.clientId]!] ?? '')
      }
    },
    [line, runLine, activeId, sessions]
  )

  const selectTab = (id: string) => {
    lineByTab.current[activeId] = line
    setActiveId(id)
    setLine(lineByTab.current[id] ?? '')
  }

  const onLineChange = (v: string) => {
    lineByTab.current[activeId] = v
    setLine(v)
  }

  const text = (active?.lines ?? [])
    .map((l) => l.s)
    .join('')

  const displayCwd =
    active?.kind === 'user'
      ? isPlaceholderCwd(active.cwd)
        ? workspaceRoot || active.cwd || ''
        : active.cwd
      : ''

  const effPromptPath =
    active?.kind === 'user'
      ? !isPlaceholderCwd(active.cwd)
        ? active.cwd
        : workspaceRoot || '.'
      : '.'

  const prompt =
    active?.kind === 'user' &&
    typeof navigator !== 'undefined' &&
    /Win/i.test(navigator.userAgent) &&
    active.shellLabel === 'powershell'
      ? `PS ${formatPrompt(effPromptPath)}>`
      : `cerebral ${formatPrompt(effPromptPath)}>`

  const cwd = displayCwd
  const setCwdForActive = (v: string) => {
    setSessions((prev) => prev.map((s) => (s.clientId === activeId && s.kind === 'user' ? { ...s, cwd: v } : s)))
  }

  return (
    <div className="cos-term-ide" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="cos-term-toolbar">
        <span className="cos-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {active?.kind === 'user' ? 'CWD' : 'AGENT'}
        </span>
        {active?.kind === 'user' ? (
          <input
            className="cos-term-cwd"
            value={cwd}
            onChange={(e) => setCwdForActive(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const w = await window.cerebral.terminal.setCwd(cwd)
                if (!w.ok && w.error) {
                  const g = await window.cerebral.terminal.getCwd()
                  setCwdForActive(g.path)
                } else {
                  setSessions((prev) =>
                    prev.map((s) => (s.clientId === activeId && s.kind === 'user' ? { ...s, cwd: w.path || cwd } : s))
                  )
                }
              }
            }}
          />
        ) : (
          <span className="cos-mono cos-term-cwd" style={{ display: 'flex', alignItems: 'center' }}>
            {active?.title}
          </span>
        )}
        <button
          type="button"
          className="cos-term-act"
          onClick={() => {
            setSessions((prev) =>
              prev.map((s) => (s.clientId === activeId ? { ...s, lines: [{ t: 'sys' as const, s: '' }] } : s))
            )
          }}
        >
          Clear
        </button>
        <button type="button" className="cos-term-act" onClick={() => void navigator.clipboard.writeText(text)}>
          Copy
        </button>
        <button type="button" className="cos-term-act" title="New user terminal" onClick={() => doBumpAdd()}>
          +
        </button>
        <button
          type="button"
          className="cos-term-act"
          disabled={!active?.running}
          onClick={() => {
            const r = active?.running
            if (r && r !== 'pending') {
              void window.cerebral.terminal.cancel(r)
            }
          }}
        >
          Kill
        </button>
        {!!active?.running && <span className="cos-term-spin" aria-hidden />}
      </div>
      <div className="cos-term-ms">
        <div className="cos-term-ms-main">
          <div ref={outRef} className="cos-term-scroll" role="log">
            {active?.lines.map((l, i) => (
              <span key={i} className={lineClass(l.t)}>
                {l.s}
              </span>
            ))}
            {!!active?.running && <span className="cos-t-muted"> …</span>}
          </div>
          <div className="cos-term-ctrlk">Ctrl+K to generate command</div>
          {active?.kind === 'user' && (
            <div className="cos-term-inputline">
              <span className="cos-term-prompt">{prompt}</span>
              <input
                className="cos-term-line"
                value={line}
                onChange={(e) => onLineChange(e.target.value)}
                onKeyDown={onKeyDown}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={!!active.running}
              />
            </div>
          )}
          {active?.kind === 'agent' && (
            <div className="cos-term-inputline cos-term-readonlyline">
              <span className="cos-t-muted">Read-only — output from an approved or agent run.</span>
            </div>
          )}
        </div>
        <div className="cos-term-sessions" role="tablist" aria-label="Terminal sessions">
          {sessions.map((s) => {
            const isOn = s.clientId === activeId
            return (
              <button
                key={s.clientId}
                type="button"
                role="tab"
                className={isOn ? 'cos-term-srow cos-term-srow-on' : 'cos-term-srow'}
                onClick={() => selectTab(s.clientId)}
                title={s.kind === 'agent' ? s.command : s.cwd}
              >
                {s.kind === 'agent' ? <AgentIcon /> : <span className="cos-term-sps" />}
                <span className="cos-mono cos-term-stext">
                  {s.kind === 'agent' ? s.title : s.shellLabel}
                </span>
                {s.running && s.running !== 'pending' ? <span className="cos-term-sdot" title="Running" /> : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
