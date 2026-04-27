import type { ReactNode } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCerebralLayout } from '../context/CerebralTabContext'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'
import { emotivCortex } from '@/services/EmotivCortexService'
import { useIdeLayoutRuntime } from '../layout/IdeLayoutRuntimeContext'

type Item =
  | {
      type: 'item'
      label: string
      shortcut?: string
      disabled?: boolean
      sub?: boolean
      onSelect?: () => void
    }
  | { type: 'sep' }

function MenuShortcut({ k }: { k: string }): ReactNode {
  return <span className="cos-menu-shortcut">{k}</span>
}

function MenuRow({ item, close }: { item: Item; close: () => void }): ReactNode {
  if (item.type === 'sep') {
    return <div className="cos-menu-sep" role="separator" />
  }
  const { label, shortcut, disabled, sub, onSelect } = item
  const isDisabled = !!disabled || (!!sub && !onSelect)
  return (
    <button
      type="button"
      role="menuitem"
      className="cos-menu-row"
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) {
          return
        }
        onSelect?.()
        close()
      }}
    >
      <span className="cos-menu-label">
        {label}
        {sub && <span className="cos-menu-chevron">▸</span>}
      </span>
      {shortcut && !sub ? <MenuShortcut k={shortcut} /> : <span className="cos-menu-shortcut" />}
    </button>
  )
}

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

function runEdit(cmd: 'copy' | 'cut' | 'paste' | 'undo' | 'redo' | 'selectAll'): void {
  const el = document.activeElement
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (cmd === 'selectAll') {
      el.select()
      return
    }
    try {
      document.execCommand(cmd)
    } catch {
      // ignore
    }
    return
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    try {
      if (cmd === 'selectAll') {
        document.execCommand('selectAll')
      } else {
        document.execCommand(cmd)
      }
    } catch {
      // ignore
    }
  }
}

export function IDEMenubar(): ReactNode {
  const nav = useNavigate()
  const { openTab, openBrowserTab, setActivity, setBottomTab, closeTab, activeTabId, workspaceRoot, tabs, setActiveTabId } = useCerebralLayout()
  const { refresh, headset, cortex, eegLine } = useResonantAgents()
  const { bottomPanelRef, vertGroupRef } = useIdeLayoutRuntime()
  const [open, setOpen] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(null), [])

  useEffect(() => {
    if (!open) {
      return
    }
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const focusCommandPalette = useCallback(() => {
    const el = document.getElementById('cide-cmd-palette-search') as HTMLInputElement | null
    el?.focus()
  }, [])

  const openHeadsetsTab = useCallback(() => {
    setActivity('settings')
    openTab({ id: crypto.randomUUID(), title: 'Headsets', type: 'settings', data: { view: 'headsets' } })
  }, [openTab, setActivity])

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

  const onToggleDevtools = useCallback(() => {
    void window.cerebral?.window?.toggleDevtools?.()
  }, [])

  const onAbout = useCallback(async () => {
    const a = await window.cerebral?.app?.about?.()
    if (a) {
      window.alert(`${a.name}\n\nVersion ${a.version}`)
    }
  }, [])

  const onOpenExternal = useCallback((u: string) => {
    void window.cerebral?.shell?.openExternal?.(u)
  }, [])

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

  const fileSections: Item[][] = useMemo(
    () => [
    [
      {
        type: 'item',
        label: 'New Text File',
        shortcut: 'Ctrl+N',
        onSelect: () =>
          openTab({
            id: `cosf:__untitled__${Date.now()}`,
            title: 'Untitled',
            type: 'code',
            data: { path: '__untitled__' }
          })
      },
      { type: 'item', label: 'New Window', shortcut: 'Ctrl+Shift+N', disabled: true },
      { type: 'item', label: 'New Window with Profile', sub: true, disabled: true }
    ],
    [
      {
        type: 'item',
        label: 'Open File…',
        shortcut: 'Ctrl+O',
        onSelect: () => {
          void onOpenFilePicker()
        }
      },
      {
        type: 'item',
        label: 'Open Folder…',
        shortcut: 'Ctrl+K Ctrl+O',
        onSelect: () => {
          void onOpenProjectFolder()
        }
      },
      { type: 'item', label: 'Open Workspace from File…', disabled: true },
      { type: 'item', label: 'Open Recent', sub: true, disabled: true }
    ],
    [
      { type: 'item', label: 'Add Folder to Workspace…', disabled: true },
      { type: 'item', label: 'Save Workspace As…', disabled: true },
      { type: 'item', label: 'Duplicate Workspace', disabled: true }
    ],
    [
      { type: 'item', label: 'Save', shortcut: 'Ctrl+S', disabled: true },
      { type: 'item', label: 'Save As…', shortcut: 'Ctrl+Shift+S', disabled: true },
      { type: 'item', label: 'Save All', shortcut: 'Ctrl+K S', disabled: true }
    ],
    [
      { type: 'item', label: 'Share', sub: true, disabled: true }
    ],
    [
      { type: 'item', label: 'Auto Save', disabled: true },
      {
        type: 'item',
        label: 'Preferences',
        onSelect: () => {
          setActivity('settings')
          openTab({
            id: crypto.randomUUID(),
            title: 'settings.json (UI)',
            type: 'settings',
            data: { view: 'general' }
          })
        }
      }
    ],
    [
      { type: 'item', label: 'Revert File', disabled: true },
      {
        type: 'item',
        label: 'Close Editor',
        shortcut: 'Ctrl+F4',
        disabled: !activeTabId,
        onSelect: () => {
          if (activeTabId) {
            closeTab(activeTabId)
          }
        }
      },
      { type: 'item', label: 'Close Folder', shortcut: 'Ctrl+K F', disabled: true },
      {
        type: 'item',
        label: 'Close Window',
        shortcut: 'Alt+F4',
        onSelect: () => void window.cerebral?.window?.close?.()
      }
    ],
    [{ type: 'item', label: 'Exit', onSelect: () => void window.cerebral?.app?.quit?.() }]
    ],
    [activeTabId, closeTab, onOpenFilePicker, onOpenProjectFolder, openTab, setActivity]
  )

  const editSections: Item[][] = useMemo(
    () => [
    [
      {
        type: 'item',
        label: 'Undo',
        shortcut: 'Ctrl+Z',
        onSelect: () => runEdit('undo')
      },
      {
        type: 'item',
        label: 'Redo',
        shortcut: 'Ctrl+Y',
        onSelect: () => runEdit('redo')
      }
    ],
    [
      { type: 'item', label: 'Cut', shortcut: 'Ctrl+X', onSelect: () => runEdit('cut') },
      { type: 'item', label: 'Copy', shortcut: 'Ctrl+C', onSelect: () => runEdit('copy') },
      { type: 'item', label: 'Paste', shortcut: 'Ctrl+V', onSelect: () => runEdit('paste') }
    ],
    [
      { type: 'item', label: 'Find', shortcut: 'Ctrl+F', onSelect: () => focusCommandPalette() },
      { type: 'item', label: 'Replace', shortcut: 'Ctrl+H', disabled: true }
    ],
    [
      { type: 'item', label: 'Find in Files', shortcut: 'Ctrl+Shift+F', disabled: true },
      { type: 'item', label: 'Replace in Files', shortcut: 'Ctrl+Shift+H', disabled: true }
    ],
    [
      { type: 'item', label: 'Toggle Line Comment', shortcut: 'Ctrl+/', disabled: true },
      { type: 'item', label: 'Toggle Block Comment', shortcut: 'Shift+Alt+A', disabled: true },
      { type: 'item', label: 'Emmet: Expand Abbreviation', shortcut: 'Tab', disabled: true }
    ]
  ],
  [focusCommandPalette, runEdit]
  )

  const selectionSections: Item[][] = useMemo(
    () => [
    [
      { type: 'item', label: 'Select All', shortcut: 'Ctrl+A', onSelect: () => runEdit('selectAll') },
      { type: 'item', label: 'Expand Selection', shortcut: 'Shift+Alt+→', disabled: true },
      { type: 'item', label: 'Shrink Selection', shortcut: 'Shift+Alt+←', disabled: true }
    ],
    [
      { type: 'item', label: 'Copy Line Up', shortcut: 'Shift+Alt+↑', disabled: true },
      { type: 'item', label: 'Copy Line Down', shortcut: 'Shift+Alt+↓', disabled: true },
      { type: 'item', label: 'Move Line Up', shortcut: 'Alt+↑', disabled: true },
      { type: 'item', label: 'Move Line Down', shortcut: 'Alt+↓', disabled: true },
      { type: 'item', label: 'Duplicate Selection', disabled: true }
    ],
    [
      { type: 'item', label: 'Add Cursor Above', shortcut: 'Ctrl+Alt+↑', disabled: true },
      { type: 'item', label: 'Add Cursor Below', shortcut: 'Ctrl+Alt+↓', disabled: true },
      { type: 'item', label: 'Add Cursors to Line Ends', shortcut: 'Shift+Alt+I', disabled: true },
      { type: 'item', label: 'Add Next Occurrence', shortcut: 'Ctrl+D', disabled: true }
    ],
    [
      { type: 'item', label: 'Switch to Ctrl+Click for Multi-Cursor', disabled: true },
      { type: 'item', label: 'Column Selection Mode', disabled: true }
    ]
  ],
  [runEdit]
  )

  const showBottomPanel = useCallback(
    (tab: 'terminal' | 'plogs') => {
      setBottomTab(tab)
      bottomPanelRef.current?.expand()
      vertGroupRef.current?.setLayout({ main: 60, bottom: 40 })
    },
    [setBottomTab, bottomPanelRef, vertGroupRef]
  )

  const viewSections: Item[][] = useMemo(
    () => [
    [
      {
        type: 'item',
        label: 'Command Palette…',
        shortcut: 'Ctrl+Shift+P',
        onSelect: () => focusCommandPalette()
      },
      { type: 'item', label: 'Open View…', onSelect: () => focusCommandPalette() }
    ],
    [
      { type: 'item', label: 'Appearance', sub: true, disabled: true },
      { type: 'item', label: 'Editor Layout', sub: true, disabled: true }
    ],
    [
      {
        type: 'item',
        label: 'Explorer',
        shortcut: 'Ctrl+Shift+E',
        onSelect: () => {
          setActivity('explorer')
        }
      },
      {
        type: 'item',
        label: 'Search',
        shortcut: 'Ctrl+Shift+F',
        onSelect: () => setActivity('explorer')
      },
      { type: 'item', label: 'Source Control', shortcut: 'Ctrl+Shift+G', disabled: true },
      {
        type: 'item',
        label: 'Run',
        shortcut: 'Ctrl+Shift+D',
        onSelect: () => setActivity('agents')
      },
      { type: 'item', label: 'Extensions', shortcut: 'Ctrl+Shift+X', disabled: true }
    ],
    [
      {
        type: 'item',
        label: 'Problems',
        shortcut: 'Ctrl+Shift+M',
        onSelect: () => {
          setActivity('logs')
          showBottomPanel('plogs')
        }
      },
      {
        type: 'item',
        label: 'Output',
        shortcut: 'Ctrl+Shift+U',
        onSelect: () => {
          showBottomPanel('plogs')
        }
      },
      { type: 'item', label: 'Debug Console', shortcut: 'Ctrl+Shift+Alt+Y', disabled: true },
      {
        type: 'item',
        label: 'Terminal',
        shortcut: 'Ctrl+`',
        onSelect: () => {
          showBottomPanel('terminal')
        }
      }
    ],
    [
      {
        type: 'item',
        label: 'Simple Browser',
        onSelect: () => {
          openBrowserTab()
        }
      }
    ],
    [{ type: 'item', label: 'Word Wrap', shortcut: 'Alt+Z', disabled: true }]
  ],
  [focusCommandPalette, setActivity, showBottomPanel, openBrowserTab]
  )

  const goSections: Item[][] = useMemo(
    () => [
    [
      { type: 'item', label: 'Back', shortcut: 'Alt+←', disabled: true },
      { type: 'item', label: 'Forward', shortcut: 'Alt+→', disabled: true },
      { type: 'item', label: 'Last Edit Location', shortcut: 'Ctrl+K Ctrl+Q', disabled: true }
    ],
    [
      { type: 'item', label: 'Switch Editor', sub: true, disabled: true },
      { type: 'item', label: 'Switch Group', sub: true, disabled: true }
    ],
    [
      {
        type: 'item',
        label: 'Go to File…',
        shortcut: 'Ctrl+P',
        onSelect: () => focusCommandPalette()
      },
      { type: 'item', label: 'Go to Symbol in Workspace…', shortcut: 'Ctrl+T', disabled: true }
    ],
    [
      { type: 'item', label: 'Go to Symbol in Editor…', shortcut: 'Ctrl+Shift+O', disabled: true },
      { type: 'item', label: 'Go to Definition', shortcut: 'F12', disabled: true }
    ],
    [
      { type: 'item', label: 'Go to Line/Column…', shortcut: 'Ctrl+G', disabled: true },
      { type: 'item', label: 'Go to Bracket', shortcut: 'Ctrl+Shift+\\', disabled: true }
    ],
    [
      { type: 'item', label: 'Next Problem', shortcut: 'F8', disabled: true },
      { type: 'item', label: 'Previous Problem', shortcut: 'Shift+F8', disabled: true }
    ]
  ],
  [focusCommandPalette]
  )

  const runSections: Item[][] = useMemo(
    () => [
    [
      {
        type: 'item',
        label: 'Start Debugging',
        shortcut: 'F5',
        onSelect: () => {
          setBottomTab('terminal')
          bottomPanelRef.current?.expand()
          vertGroupRef.current?.setLayout({ main: 60, bottom: 40 })
        }
      },
      {
        type: 'item',
        label: 'Run Without Debugging',
        shortcut: 'Ctrl+F5',
        onSelect: () => {
          setBottomTab('terminal')
          bottomPanelRef.current?.expand()
          vertGroupRef.current?.setLayout({ main: 60, bottom: 40 })
        }
      }
    ],
    [
      { type: 'item', label: 'Toggle Breakpoint', shortcut: 'F9', disabled: true },
      { type: 'item', label: 'New Breakpoint', sub: true, disabled: true }
    ],
    [{ type: 'item', label: 'Install Additional Debuggers…', disabled: true }]
  ],
  [setBottomTab, bottomPanelRef, vertGroupRef]
  )

  const terminalSections: Item[][] = [
    [
      {
        type: 'item',
        label: 'New Terminal',
        onSelect: () => {
          setBottomTab('terminal')
          bottomPanelRef.current?.expand()
        }
      },
      { type: 'item', label: 'Split Terminal', disabled: true }
    ],
    [
      {
        type: 'item',
        label: 'Scroll to Bottom',
        onSelect: () => {
          setBottomTab('terminal')
        }
      }
    ]
  ]

  const headsetsSections: Item[][] = [
    [
      {
        type: 'item',
        label: 'Open Headsets & EMOTIV Insight',
        onSelect: openHeadsetsTab
      }
    ],
    [
      {
        type: 'item',
        label: 'Scan for headsets (Cortex)',
        onSelect: () => {
          void (async () => {
            try {
              await emotivCortex.queryHeadsets()
            } catch {
              // status shown in status bar
            }
          })()
        }
      },
      {
        type: 'item',
        label: 'EMOTIV / Cortex help',
        onSelect: () => onOpenExternal('https://emotiv.com/')
      }
    ],
    [
      {
        type: 'item',
        label: `Cortex: ${cortex.ok === true ? 'ok' : cortex.ok === false ? 'unreachable' : '—'}`,
        disabled: true
      },
      { type: 'item', label: `Headset: ${headset}`, disabled: true },
      { type: 'item', label: `Stream: ${eegLine.slice(0, 64)}${eegLine.length > 64 ? '…' : ''}`, disabled: true }
    ]
  ]

  const helpSections: Item[][] = [
    [
      { type: 'item', label: 'Show All Commands', shortcut: 'Ctrl+Shift+P', onSelect: () => focusCommandPalette() },
      { type: 'item', label: 'Get Started with Accessibility', disabled: true }
    ],
    [
      { type: 'item', label: 'Give Feedback…', disabled: true }
    ],
    [
      { type: 'item', label: 'Toggle Developer Tools', onSelect: onToggleDevtools }
    ],
    [{ type: 'item', label: 'About CEREBRAL OS', onSelect: () => void onAbout() }]
  ]

  const menus: { id: string; label: string; sections: Item[][] }[] = [
    { id: 'file', label: 'File', sections: fileSections },
    { id: 'edit', label: 'Edit', sections: editSections },
    { id: 'sel', label: 'Selection', sections: selectionSections },
    { id: 'view', label: 'View', sections: viewSections },
    { id: 'go', label: 'Go', sections: goSections },
    { id: 'run', label: 'Run', sections: runSections },
    { id: 'term', label: 'Terminal', sections: terminalSections },
    { id: 'head', label: 'Headsets', sections: headsetsSections },
    { id: 'help', label: 'Help', sections: helpSections }
  ]

  return (
    <div className="cos-menubar" ref={rootRef} role="menubar" aria-label="Application">
      {menus.map((m) => {
        const isOpen = open === m.id
        return (
          <div key={m.id} className="cos-menubar-item">
            <button
              type="button"
              className={isOpen ? 'cos-menubar-top is-open' : 'cos-menubar-top'}
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={isOpen}
              onMouseEnter={() => {
                if (open) {
                  setOpen(m.id)
                }
              }}
              onClick={() => setOpen((v) => (v === m.id ? null : m.id))}
            >
              {m.label}
            </button>
            {isOpen && (
              <div className="cos-menubar-panel" role="menu">
                {m.sections.map((section, si) => (
                  <Fragment key={si}>
                    {section.map((it, ii) => (
                      <MenuRow key={`${m.id}-${si}-${ii}`} item={it} close={close} />
                    ))}
                    {si < m.sections.length - 1 && <div className="cos-menu-sep" role="separator" />}
                  </Fragment>
                ))}
                {m.id === 'file' && (
                  <>
                    <div className="cos-menu-sep" role="separator" />
                    <button
                      type="button"
                      role="menuitem"
                      className="cos-menu-row"
                      onClick={() => {
                        nav('/cerebral/welcome')
                        close()
                      }}
                    >
                      <span className="cos-menu-label">Welcome / change project…</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
