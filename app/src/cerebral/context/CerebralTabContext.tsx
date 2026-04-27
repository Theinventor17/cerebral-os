import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { CerebralActivityId, CerebralTab } from '../types/cerebral.ts'
import { saveLayoutPatch } from '../layout/layoutStore'

type OpenTabOptions = { activate?: boolean; insertAfterTabId?: string | null }

type Ctx = {
  activity: CerebralActivityId
  setActivity: (a: CerebralActivityId) => void
  /** True after the initial workspace tab list is loaded from SQLite (avoid races with openTab). */
  hasHydrated: boolean
  tabs: CerebralTab[]
  activeTabId: string | null
  setActiveTabId: (id: string | null) => void
  openTab: (t: CerebralTab, options?: OpenTabOptions) => void
  closeTab: (id: string) => void
  markDirty: (id: string, dirty: boolean) => void
  updateTab: (id: string, partial: Partial<CerebralTab>) => void
  openAgentChat: (agentId: string, name: string) => void
  openBrowserTab: (initialUrl?: string) => void
  workspaceRoot: string | null
  bottomTab: string
  setBottomTab: (t: string) => void
  rightTab: string
  setRightTab: (t: string) => void
  persistNow: () => void
}

const W = 'default'

const CerCtx = createContext<Ctx | null>(null)

function rowsToTabs(rows: Array<Record<string, unknown>>): CerebralTab[] {
  return rows.map((r) => {
    let data: Record<string, unknown> | undefined
    try {
      if (r.data_json) {
        data = JSON.parse(String(r.data_json)) as Record<string, unknown>
      }
    } catch {
      data = undefined
    }
    return {
      id: String(r.id),
      title: String(r.title),
      type: r.type as CerebralTab['type'],
      isDirty: Number(r.is_dirty) === 1,
      data
    }
  })
}

function tabsToRows(tabs: CerebralTab[]): Array<{
  id: string
  title: string
  type: string
  data_json: string | null
  sort_order: number
  is_dirty: number
}> {
  return tabs.map((t, i) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    data_json: t.data == null ? null : JSON.stringify(t.data),
    sort_order: i,
    is_dirty: t.isDirty ? 1 : 0
  }))
}

export function CerebralTabProvider({ children }: { children: ReactNode }): ReactNode {
  const [activity, setActivity] = useState<CerebralActivityId>('agents')
  const [tabs, setTabs] = useState<CerebralTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [bottomTab, setBottomTab] = useState('terminal')
  const [rightTab, setRightTab] = useState('agent')
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hasHydrated, setHasHydrated] = useState(false)

  const persistNow = useCallback(() => {
    if (!hasHydrated) {
      return
    }
    const rows = tabsToRows(tabs)
    void window.cerebral.tabs.replace({ workspaceId: W, tabs: rows })
  }, [tabs, hasHydrated])

  useEffect(() => {
    const onMutated = () => {
      void window.cerebral.workspace.default().then((ws) => {
        if (ws.rootPath) {
          setWorkspaceRoot(ws.rootPath)
        }
      })
    }
    window.addEventListener('cerebral:workspace:mutated', onMutated)
    return () => window.removeEventListener('cerebral:workspace:mutated', onMutated)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const ws = await window.cerebral.workspace.default()
        if (ws.rootPath) {
          setWorkspaceRoot(ws.rootPath)
        }
        const dbTabs = (await window.cerebral.tabs.get(W)) as Array<Record<string, unknown>>
        if (dbTabs.length > 0) {
          const next = rowsToTabs(dbTabs)
          setTabs(next)
          setActiveTabId(next[0]?.id ?? null)
          return
        }
        const agents = (await window.ra.agent.list()) as Array<{ id: string; name: string }>
        if (agents.length) {
          const a = agents[0]
          const t: CerebralTab = { id: crypto.randomUUID(), title: `${a.name}.chat`, type: 'agent_chat', data: { agentId: a.id } }
          setTabs([t])
          setActiveTabId(t.id)
          void window.cerebral.tabs.replace({ workspaceId: W, tabs: tabsToRows([t]) })
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[Cerebral] Tab hydration failed', e)
      } finally {
        setHasHydrated(true)
      }
    })()
  }, [])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }
    if (persistTimer.current) {
      clearTimeout(persistTimer.current)
    }
    persistTimer.current = setTimeout(() => {
      const rows = tabsToRows(tabs)
      void window.cerebral.tabs.replace({ workspaceId: W, tabs: rows })
    }, 450)
    return () => {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current)
      }
    }
  }, [tabs, hasHydrated])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }
    saveLayoutPatch({ activity, bottomTab, rightTab })
  }, [hasHydrated, activity, bottomTab, rightTab])

  const openTab = useCallback((t: CerebralTab, options?: OpenTabOptions) => {
    const shouldActivate = options?.activate !== false
    const after = options?.insertAfterTabId
    setTabs((prev) => {
      const ex = prev.find((x) => x.id === t.id)
      if (ex) {
        return prev
      }
      if (after) {
        const j = prev.findIndex((x) => x.id === after)
        if (j >= 0) {
          return [...prev.slice(0, j + 1), t, ...prev.slice(j + 1)]
        }
      }
      return [...prev, t]
    })
    if (shouldActivate) {
      setActiveTabId(t.id)
    }
  }, [])

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id)
      setActiveTabId((cur) => {
        if (cur !== id) {
          return cur
        }
        const idx = prev.findIndex((t) => t.id === id)
        const rep = next[Math.max(0, idx - 1)] ?? next[0] ?? null
        return rep ? rep.id : null
      })
      return next
    })
  }, [])

  const markDirty = useCallback((id: string, dirty: boolean) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isDirty: dirty } : t)))
  }, [])

  const updateTab = useCallback((id: string, partial: Partial<CerebralTab>) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== id) {
          return t
        }
        const next: CerebralTab = { ...t, ...partial }
        if (partial.data != null && t.data != null) {
          next.data = { ...t.data, ...partial.data } as Record<string, unknown>
        }
        return next
      })
    )
  }, [])

  const openAgentChat = useCallback((agentId: string, name: string) => {
    const title = `${name}.chat`
    setTabs((prev) => {
      const ex = prev.find((t) => t.type === 'agent_chat' && t.data && String(t.data['agentId']) === agentId)
      if (ex) {
        setActiveTabId(ex.id)
        return prev
      }
      const t: CerebralTab = { id: crypto.randomUUID(), title, type: 'agent_chat', data: { agentId } }
      setActiveTabId(t.id)
      return [...prev, t]
    })
  }, [])

  const openBrowserTab = useCallback(
    (initialUrl?: string) => {
      const u = (initialUrl && initialUrl.trim()) || 'http://127.0.0.1:3000/'
      let title = 'Browser'
      try {
        if (!u.startsWith('about:')) {
          const h = new URL(u).hostname
          if (h) {
            title = h
          }
        }
      } catch {
        // keep default
      }
      const t: CerebralTab = { id: crypto.randomUUID(), title, type: 'browser', data: { url: u } }
      openTab(t)
    },
    [openTab]
  )

  const value = useMemo<Ctx>(
    () => ({
      activity,
      setActivity,
      hasHydrated,
      tabs,
      activeTabId,
      setActiveTabId,
      openTab,
      closeTab,
      markDirty,
      updateTab,
      openAgentChat,
      openBrowserTab,
      workspaceRoot,
      bottomTab,
      setBottomTab,
      rightTab,
      setRightTab,
      persistNow
    }),
    [
      activity,
      hasHydrated,
      tabs,
      activeTabId,
      openTab,
      closeTab,
      markDirty,
      updateTab,
      openAgentChat,
      openBrowserTab,
      workspaceRoot,
      bottomTab,
      rightTab,
      persistNow
    ]
  )

  return <CerCtx.Provider value={value}>{children}</CerCtx.Provider>
}

export function useCerebralLayout(): Ctx {
  const c = useContext(CerCtx)
  if (!c) {
    throw new Error('useCerebralLayout requires CerebralTabProvider')
  }
  return c
}
