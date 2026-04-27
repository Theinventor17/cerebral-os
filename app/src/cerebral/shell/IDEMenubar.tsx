import type { ReactNode } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CEREBRAL_HEADSETS_TAB_ID } from '../headsetsTabConstants'
import { useCerebralLayout } from '../context/CerebralTabContext'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'
import { emotivCortex } from '@/services/EmotivCortexService'
import { useIdeLayoutRuntime } from '../layout/IdeLayoutRuntimeContext'
import { useIdeWorkspaceFileActions } from './ideWorkspaceFileActions'

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
  const showShortcut = Boolean(shortcut && !sub && !isDisabled)
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
      {showShortcut ? <MenuShortcut k={shortcut!} /> : <span className="cos-menu-shortcut" />}
    </button>
  )
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

export function IDEMenubar({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }): ReactNode {
  const nav = useNavigate()
  const { openTab, openBrowserTab, setActivity, setBottomTab, closeTab, activeTabId } = useCerebralLayout()
  const { onOpenFilePicker, onOpenProjectFolder } = useIdeWorkspaceFileActions()
  const { headset, cortex, eegLine } = useResonantAgents()
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

  const openHeadsetsTab = useCallback(() => {
    setActivity('headsets')
    openTab({ id: CEREBRAL_HEADSETS_TAB_ID, title: 'Headsets', type: 'headsets', data: {} })
  }, [openTab, setActivity])

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
        {
          type: 'item',
          label: 'Open File…',
          shortcut: 'Ctrl+O',
          onSelect: () => void onOpenFilePicker()
        },
        {
          type: 'item',
          label: 'Open Folder…',
          onSelect: () => void onOpenProjectFolder()
        }
      ],
      [
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
        {
          type: 'item',
          label: 'Close Editor',
          disabled: !activeTabId,
          onSelect: () => {
            if (activeTabId) {
              closeTab(activeTabId)
            }
          }
        },
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
      [{ type: 'item', label: 'Find in chat / command palette', shortcut: 'Ctrl+F', onSelect: () => onOpenCommandPalette() }]
    ],
    [onOpenCommandPalette, runEdit]
  )

  const selectionSections: Item[][] = useMemo(
    () => [
      [{ type: 'item', label: 'Select All', shortcut: 'Ctrl+A', onSelect: () => runEdit('selectAll') }]
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
          onSelect: () => onOpenCommandPalette()
        }
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
          label: 'Search (activity)',
          shortcut: 'Ctrl+Shift+F',
          onSelect: () => setActivity('explorer')
        },
        {
          type: 'item',
          label: 'Run / Agents',
          shortcut: 'Ctrl+Shift+D',
          onSelect: () => setActivity('agents')
        }
      ],
      [
        {
          type: 'item',
          label: 'Problems (logs)',
          shortcut: 'Ctrl+Shift+M',
          onSelect: () => {
            setActivity('logs')
            showBottomPanel('plogs')
          }
        },
        {
          type: 'item',
          label: 'Output (provider logs)',
          shortcut: 'Ctrl+Shift+U',
          onSelect: () => {
            showBottomPanel('plogs')
          }
        },
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
      ]
    ],
    [onOpenCommandPalette, setActivity, showBottomPanel, openBrowserTab]
  )

  const goSections: Item[][] = useMemo(
    () => [
      [
        {
          type: 'item',
          label: 'Command palette (quick list)',
          shortcut: 'Ctrl+P',
          onSelect: () => onOpenCommandPalette()
        }
      ]
    ],
    [onOpenCommandPalette]
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
      ]
    ],
    [setBottomTab, bottomPanelRef, vertGroupRef]
  )

  const terminalSections: Item[][] = [
    [
      {
        type: 'item',
        label: 'New Terminal (focus bottom)',
        onSelect: () => {
          setBottomTab('terminal')
          bottomPanelRef.current?.expand()
        }
      },
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
    [{ type: 'item', label: 'Show All Commands', shortcut: 'Ctrl+Shift+P', onSelect: () => onOpenCommandPalette() }],
    [
      { type: 'item', label: 'Keyboard shortcuts (in-app)', onSelect: () => {
        setActivity('settings')
        openTab({ id: crypto.randomUUID(), title: 'Keyboard shortcuts', type: 'settings', data: { view: 'keyboard-shortcuts' } })
      } }
    ],
    [{ type: 'item', label: 'Toggle Developer Tools', onSelect: onToggleDevtools }],
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
