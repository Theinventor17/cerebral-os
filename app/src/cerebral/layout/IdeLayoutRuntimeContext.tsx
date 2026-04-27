import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { GroupImperativeHandle, PanelImperativeHandle } from 'react-resizable-panels'

type C = {
  leftPanelRef: React.RefObject<PanelImperativeHandle | null>
  rightPanelRef: React.RefObject<PanelImperativeHandle | null>
  bottomPanelRef: React.RefObject<PanelImperativeHandle | null>
  mainPanelRef: React.RefObject<PanelImperativeHandle | null>
  vertGroupRef: React.RefObject<GroupImperativeHandle | null>
  horGroupRef: React.RefObject<GroupImperativeHandle | null>
}

const I = createContext<C | null>(null)

export function IdeLayoutRuntimeProvider({ value, children }: { value: C; children: ReactNode }): ReactNode {
  return <I.Provider value={value}>{children}</I.Provider>
}

export function useIdeLayoutRuntime(): C {
  const x = useContext(I)
  if (!x) {
    throw new Error('useIdeLayoutRuntime requires provider')
  }
  return x
}
