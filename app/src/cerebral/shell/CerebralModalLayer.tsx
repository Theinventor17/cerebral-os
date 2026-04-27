import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Rnd } from 'react-rnd'

export type CerebralModalKind = 'provider' | 'agent' | 'skill' | 'approval' | 'report'

export type CerebralModalState = {
  id: string
  kind: CerebralModalKind
  title: string
  children: ReactNode
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
}

type Ctx = {
  stack: CerebralModalState[]
  openModal: (m: Omit<CerebralModalState, 'z' | 'minimized'> & { z?: number; minimized?: boolean }) => void
  closeModal: (id: string) => void
  bringFront: (id: string) => void
  toggleMin: (id: string) => void
}

const M = createContext<Ctx | null>(null)

export function useCerebralModals(): Ctx {
  const c = useContext(M)
  if (!c) {
    throw new Error('useCerebralModals requires CerebralModalLayer')
  }
  return c
}

export function CerebralModalLayer(): ReactNode {
  const [stack, setStack] = useState<CerebralModalState[]>([])

  const openModal = useCallback((m: Omit<CerebralModalState, 'z' | 'minimized'> & { z?: number; minimized?: boolean }) => {
    setStack((s) => {
      const z = m.z ?? Math.max(40, ...s.map((x) => x.z), 100) + 1
      const next: CerebralModalState = {
        ...m,
        z,
        minimized: m.minimized ?? false
      }
      return [...s.filter((x) => x.id !== m.id), next]
    })
  }, [])

  const closeModal = useCallback((id: string) => {
    setStack((s) => s.filter((x) => x.id !== id))
  }, [])

  const bringFront = useCallback((id: string) => {
    setStack((s) => {
      const z = Math.max(40, ...s.map((x) => x.z)) + 1
      return s.map((x) => (x.id === id ? { ...x, z } : x))
    })
  }, [])

  const toggleMin = useCallback((id: string) => {
    setStack((s) => s.map((x) => (x.id === id ? { ...x, minimized: !x.minimized } : x)))
  }, [])

  const value = useMemo<Ctx>(
    () => ({ stack, openModal, closeModal, bringFront, toggleMin }),
    [stack, openModal, closeModal, bringFront, toggleMin]
  )

  return (
    <M.Provider value={value}>
      {stack.map((m) => (
        <Rnd
          key={m.id}
          className="cos-floating"
          style={{ zIndex: m.z }}
          size={{ width: m.minimized ? 280 : m.w, height: m.minimized ? 36 : m.h }}
          position={{ x: m.x, y: m.y }}
          onDragStop={(_e, d) => {
            setStack((s) => s.map((x) => (x.id === m.id ? { ...x, x: d.x, y: d.y } : x)))
          }}
          onResizeStop={(_e, _d, ref, _p, pos) => {
            setStack((s) =>
              s.map((x) =>
                x.id === m.id
                  ? { ...x, w: ref.offsetWidth, h: ref.offsetHeight, x: pos.x, y: pos.y }
                  : x
              )
            )
          }}
          bounds="parent"
          minWidth={240}
          minHeight={m.minimized ? 36 : 120}
          dragHandleClassName="cos-float-drag"
          onMouseDown={() => bringFront(m.id)}
        >
          <div
            className="cos-floating-inner"
            onMouseDown={() => bringFront(m.id)}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
          >
            <div className="cos-float-h cos-float-drag">
              <span className="cos-float-title">{m.title}</span>
              <div className="cos-float-ctrl">
                <button type="button" onClick={() => toggleMin(m.id)} title="Minimize">─</button>
                <button type="button" onClick={() => closeModal(m.id)} title="Close">×</button>
              </div>
            </div>
            {!m.minimized && <div className="cos-float-body">{m.children}</div>}
          </div>
        </Rnd>
      ))}
    </M.Provider>
  )
}
