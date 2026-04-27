import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { Group, Panel, Separator, useGroupRef, usePanelRef } from 'react-resizable-panels'
import { ActivityBar } from './ActivityBar'
import { SidePanel } from './SidePanel'
import { EditorWorkspace } from './EditorWorkspace'
import { RightInspector } from './RightInspector'
import { BottomPanel } from './BottomPanel'
import { CommandBar } from './CommandBar'
import { useCerebralLayout } from '../context/CerebralTabContext'
import { IdeLayoutRuntimeProvider } from '../layout/IdeLayoutRuntimeContext'
import { loadLayout, saveLayoutPatch, type CerebralLayoutV1 } from '../layout/layoutStore'

const DEF_VERT = { main: 74, bottom: 26 }
const DEF_HOR = { left: 18, center: 64, right: 18 }

export function IdeDockLayout(): ReactNode {
  const { setActivity, setBottomTab, setRightTab } = useCerebralLayout()
  const layoutLoaded = useRef(false)

  const vertGroupRef = useGroupRef()
  const horGroupRef = useGroupRef()
  const leftPanelRef = usePanelRef()
  const rightPanelRef = usePanelRef()
  const bottomPanelRef = usePanelRef()
  const mainPanelRef = usePanelRef()
  const debounceT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mergeLayout = useCallback(
    (patch: Partial<Pick<CerebralLayoutV1, 'vert' | 'hor'>>) => {
      if (debounceT.current) {
        clearTimeout(debounceT.current)
      }
      debounceT.current = setTimeout(() => {
        saveLayoutPatch(patch)
      }, 120)
    },
    []
  )

  const onVertChanged = useCallback(
    (layout: Record<string, number>) => {
      mergeLayout({ vert: { main: layout['main'] ?? layout.main, bottom: layout['bottom'] ?? layout.bottom } })
    },
    [mergeLayout]
  )

  const onHorChanged = useCallback(
    (layout: Record<string, number>) => {
      mergeLayout({
        hor: { left: layout['left'] ?? layout.left, center: layout['center'] ?? layout.center, right: layout['right'] ?? layout.right }
      })
    },
    [mergeLayout]
  )

  const saved = loadLayout()
  const dVert = saved?.vert
    ? { main: saved.vert.main ?? DEF_VERT.main, bottom: saved.vert.bottom ?? DEF_VERT.bottom }
    : DEF_VERT
  const dHor = saved?.hor
    ? {
        left: saved.hor.left ?? DEF_HOR.left,
        center: saved.hor.center ?? DEF_HOR.center,
        right: saved.hor.right ?? DEF_HOR.right
      }
    : DEF_HOR

  useEffect(() => {
    if (layoutLoaded.current) {
      return
    }
    const l = loadLayout()
    if (l?.activity) {
      setActivity(l.activity)
    }
    if (l?.bottomTab) {
      setBottomTab(l.bottomTab)
    }
    if (l?.rightTab) {
      setRightTab(l.rightTab)
    }
    layoutLoaded.current = true
  }, [setActivity, setBottomTab, setRightTab])

  return (
    <IdeLayoutRuntimeProvider
      value={{
        leftPanelRef,
        rightPanelRef,
        bottomPanelRef,
        mainPanelRef,
        vertGroupRef,
        horGroupRef
      }}
    >
      <CommandBar />
      <div className="cos-dock-outer" style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Group
          orientation="vertical"
          className="cos-group-vert"
          id="cerebral-dock-vert"
          groupRef={vertGroupRef}
          defaultLayout={{ main: dVert.main, bottom: dVert.bottom }}
          onLayoutChanged={onVertChanged as (l: Record<string, number>) => void}
          style={{ flex: 1, minHeight: 0 }}
        >
          <Panel
            className="cos-panel"
            id="main"
            minSize="38%"
            defaultSize="74%"
            panelRef={mainPanelRef}
            style={{ minHeight: 0, display: 'flex' }}
          >
            <div className="cos-row-main">
              <ActivityBar />
              <Group
                orientation="horizontal"
                className="cos-group-hor"
                id="cerebral-dock-hor"
                groupRef={horGroupRef}
                defaultLayout={{ left: dHor.left, center: dHor.center, right: dHor.right }}
                onLayoutChanged={onHorChanged as (l: Record<string, number>) => void}
                style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}
              >
                <Panel
                  className="cos-panel cos-panel-side"
                  id="left"
                  minSize="12%"
                  maxSize="30%"
                  defaultSize="18%"
                  collapsible
                  panelRef={leftPanelRef}
                  style={{ minWidth: 0, display: 'flex', minHeight: 0 }}
                >
                  <SidePanel />
                </Panel>
                <Separator className="cos-dock-sep" />
                <Panel className="cos-panel" id="center" minSize="32%" defaultSize="64%" style={{ minWidth: 0, minHeight: 0, display: 'flex' }}>
                  <EditorWorkspace />
                </Panel>
                <Separator className="cos-dock-sep" />
                <Panel
                  className="cos-panel"
                  id="right"
                  minSize="12%"
                  maxSize="32%"
                  defaultSize="18%"
                  collapsible
                  panelRef={rightPanelRef}
                  style={{ minWidth: 0, minHeight: 0, display: 'flex' }}
                >
                  <RightInspector />
                </Panel>
              </Group>
            </div>
          </Panel>
          <Separator className="cos-dock-sep-h" />
          <Panel
            className="cos-panel"
            id="bottom"
            minSize="12%"
            maxSize="55%"
            defaultSize="26%"
            collapsible
            panelRef={bottomPanelRef}
            style={{ minHeight: 0, display: 'flex' }}
          >
            <BottomPanel />
          </Panel>
        </Group>
      </div>
    </IdeLayoutRuntimeProvider>
  )
}
