import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'
import type { SessionMode } from '@/types'
import { CEREBRAL_HEADSETS_TAB_ID } from '../headsetsTabConstants'
import { useCerebralLayout } from '../context/CerebralTabContext'
import type { CerebralActivityId } from '../types/cerebral.ts'

type Cmd = {
  id: string
  label: string
  section: string
  keywords: string[]
  run: () => void
}

function matchesQuery(query: string, c: Cmd): boolean {
  const t = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (t.length === 0) {
    return true
  }
  const hay = `${c.label} ${c.section} ${c.keywords.join(' ')}`.toLowerCase()
  return t.every((tok) => hay.includes(tok))
}

export function IdeCommandPalette({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const nav = useNavigate()
  const { setActivity, openTab, openAgentChat, openBrowserTab } = useCerebralLayout()
  const { setSessionMode, agents, activeAgent } = useResonantAgents()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const filteredRef = useRef<Cmd[]>([])

  const withClose = useCallback(
    (fn: () => void) => {
      fn()
      onClose()
    },
    [onClose]
  )

  const goActivity = useCallback(
    (a: CerebralActivityId) => {
      setActivity(a)
      if (a === 'headsets') {
        openTab({ id: CEREBRAL_HEADSETS_TAB_ID, title: 'Headsets', type: 'headsets', data: {} })
      }
    },
    [setActivity, openTab]
  )

  const commands = useMemo((): Cmd[] => {
    const out: Cmd[] = []
    const addAct = (id: CerebralActivityId, label: string, section: string, keywords: string[]) => {
      out.push({
        id: `act-${id}`,
        label,
        section,
        keywords: [...keywords, id],
        run: () => withClose(() => goActivity(id))
      })
    }
    const addMode = (m: SessionMode, label: string, keywords: string[]) => {
      out.push({
        id: `mode-${m}`,
        label,
        section: 'Session mode',
        keywords: [...keywords, m, 'mode'],
        run: () => withClose(() => void setSessionMode(m))
      })
    }

    addAct('explorer', 'Go to Explorer', 'Activity', ['files', 'sidebar', 'tree'])
    addAct('agents', 'Go to Agents', 'Activity', ['chat', 'list', 'conversations'])
    addAct('swarms', 'Go to Swarms', 'Activity', ['workflow', 'orchestration'])
    addAct('skills', 'Go to Skills', 'Activity', ['marketplace', 'claude'])
    addAct('providers', 'Go to Providers (models & API keys)', 'Activity', ['model', 'ollama', 'openrouter', 'key'])
    addAct('memory', 'Go to Memory', 'Activity', ['memory'])
    addAct('headsets', 'Go to Headsets', 'Activity', ['emotiv', 'eeg', 'cortex', 'insight', 'neural', '◎'])
    addAct('logs', 'Go to Logs', 'Activity', ['logs', 'log'])
    addAct('settings', 'Go to Settings', 'Activity', ['preferences', '⛭'])

    addMode('manual', 'Set session mode: Manual', ['keyboard', 'type', 'no headset'])
    addMode('hybrid', 'Set session mode: Hybrid', ['keyboard', 'neural', 'insight when live'])
    addMode('thought', 'Set session mode: Thought', ['neural', 'emotiv', 'headset first'])

    out.push({
      id: 'set-general',
      label: 'Open: General settings',
      section: 'Settings',
      keywords: ['workspace', 'local only', 'demo', 'json'],
      run: () =>
        withClose(() =>
          openTab({ id: crypto.randomUUID(), title: 'settings.json (UI)', type: 'settings', data: { view: 'general' } })
        )
    })
    out.push({
      id: 'set-kbd',
      label: 'Open: Keyboard shortcuts',
      section: 'Settings',
      keywords: ['shortcuts', 'hotkey', 'keys', 'reference', 'ctrl'],
      run: () =>
        withClose(() =>
          openTab({ id: crypto.randomUUID(), title: 'Keyboard shortcuts', type: 'settings', data: { view: 'keyboard-shortcuts' } })
        )
    })
    out.push({
      id: 'nav-welcome',
      label: 'Open project / Welcome',
      section: 'Navigation',
      keywords: ['folder', 'workspace', 'root', 'clone', 'start', 'project'],
      run: () => withClose(() => nav('/cerebral/welcome'))
    })
    out.push({
      id: 'open-browser',
      label: 'Open browser tab',
      section: 'Tabs',
      keywords: ['webview', 'url', 'http', 'https'],
      run: () => withClose(() => openBrowserTab())
    })

    if (activeAgent) {
      out.push({
        id: 'focus-active-chat',
        label: `Focus chat: ${activeAgent.name}`,
        section: 'Agents',
        keywords: [activeAgent.name.toLowerCase(), 'current', 'active'],
        run: () => withClose(() => openAgentChat(activeAgent.id, activeAgent.name))
      })
    }
    for (const a of agents) {
      out.push({
        id: `open-agent-${a.id}`,
        label: `Open chat: ${a.name}`,
        section: 'Agents',
        keywords: [a.name.toLowerCase(), a.id, 'agent', 'chat'],
        run: () => withClose(() => openAgentChat(a.id, a.name))
      })
    }

    return out
  }, [activeAgent, agents, goActivity, nav, openAgentChat, openBrowserTab, openTab, setSessionMode, withClose])

  const filtered = useMemo(() => commands.filter((c) => matchesQuery(q, c)), [commands, q])
  filteredRef.current = filtered

  useEffect(() => {
    if (!open) {
      return
    }
    setQ('')
    setSel(0)
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    setSel((s) => {
      const n = filtered.length
      if (n === 0) {
        return 0
      }
      return Math.min(s, n - 1)
    })
  }, [filtered.length, q])

  const execSelected = useCallback(() => {
    const list = filteredRef.current
    const c = list[sel]
    if (c) {
      c.run()
    }
  }, [sel])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSel((i) => {
          const m = (filteredRef.current.length || 1) - 1
          return Math.min(m, i + 1)
        })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSel((i) => Math.max(0, i - 1))
        return
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose, execSelected])

  if (!open) {
    return null
  }

  return (
    <div
      className="cos-cmd-pal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="cos-cmd-pal"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="cos-cmd-pal-hint">Filter — activities, session mode, settings, agent chats, browser</p>
        <input
          ref={inputRef}
          id="cide-cmd-palette-search"
          type="search"
          className="cos-cmd-pal-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              execSelected()
            }
          }}
          placeholder="Run command…"
          aria-label="Filter commands"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="cos-cmd-pal-list" role="listbox" aria-label="Commands">
          {filtered.length === 0 && <div className="cos-cmd-pal-empty">No matches</div>}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={i === sel}
              className={`cos-cmd-pal-row${i === sel ? ' cos-cmd-pal-row--sel' : ''}`.trim()}
              onClick={() => c.run()}
              onMouseEnter={() => setSel(i)}
            >
              <span className="cos-cmd-pal-label">{c.label}</span>
              <span className="cos-cmd-pal-sec">{c.section}</span>
            </button>
          ))}
        </div>
        <p className="cos-cmd-pal-foot">↑ ↓ · Enter · Esc · Ctrl+Shift+P to open from anywhere in the IDE</p>
      </div>
    </div>
  )
}
