import { useCallback } from 'react'
import { useCerebralLayout } from '../context/CerebralTabContext'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'

function absToWorkspaceRel(fileAbs: string, root: string): string | null {
  const f = fileAbs.replace(/\\/g, '/')
  const r = root.replace(/\\/g, '/').replace(/\/$/, '')
  if (f.length < r.length + 2) {
    return null
  }
  const fl = f.toLowerCase()
  const rl = r.toLowerCase()
  if (!fl.startsWith(rl + '/')) {
    return null
  }
  return f.slice(r.length + 1)
}

/** File → Open and File → Open Folder — shared by the menubar and global shortcuts. */
export function useIdeWorkspaceFileActions() {
  const { openTab, setActiveTabId, workspaceRoot, tabs } = useCerebralLayout()
  const { refresh } = useResonantAgents()

  const onOpenFilePicker = useCallback(async () => {
    const c = window.cerebral
    if (!c?.pickWorkspaceFile) {
      return
    }
    const { path: abs } = await c.pickWorkspaceFile()
    if (!abs) {
      return
    }
    if (!workspaceRoot) {
      window.alert('Set a project folder first (File → Open Folder…).')
      return
    }
    const rel = absToWorkspaceRel(abs, workspaceRoot)
    if (!rel) {
      window.alert('Choose a file inside the current project folder.')
      return
    }
    const norm = rel.replace(/\\/g, '/')
    const ex = tabs.find(
      (x) => x.type === 'code' && String(x.data?.['path'] ?? '').replace(/\\/g, '/') === norm
    )
    if (ex) {
      setActiveTabId(ex.id)
      return
    }
    openTab({
      id: `cosf:${encodeURIComponent(norm)}`,
      title: norm.split('/').pop() || norm,
      type: 'code',
      data: { path: norm }
    })
  }, [openTab, setActiveTabId, tabs, workspaceRoot])

  const onOpenProjectFolder = useCallback(async () => {
    const c = window.cerebral
    if (!c?.workspace?.pickDirectory) {
      return
    }
    const r = await c.workspace.pickDirectory()
    if (r?.path) {
      const setR = await c.workspace.setRoot({ rootPath: r.path })
      if (setR.ok) {
        try {
          localStorage.setItem('cerebral.lastRootHint', r.path)
        } catch {
          // ignore
        }
        void refresh()
      }
    }
  }, [refresh])

  return { onOpenFilePicker, onOpenProjectFolder }
}
