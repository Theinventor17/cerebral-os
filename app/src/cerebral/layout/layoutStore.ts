import type { CerebralActivityId } from '../types/cerebral.ts'

const KEY = 'cerebral.layout.v1'

export type CerebralLayoutV1 = {
  v: 1
  /** Vertical group: main vs bottom (percent) */
  vert?: { main?: number; bottom?: number }
  /** Horizontal: left, center, right (percent) */
  hor?: { left?: number; center?: number; right?: number }
  leftCollapsed?: boolean
  rightCollapsed?: boolean
  bottomCollapsed?: boolean
  bottomMax?: boolean
  editorMax?: boolean
  activity?: CerebralActivityId
  bottomTab?: string
  rightTab?: string
  modals?: Record<string, { x: number; y: number; w: number; h: number; z: number; minimized?: boolean }>
}

export function loadLayout(): CerebralLayoutV1 | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as CerebralLayoutV1
  } catch {
    return null
  }
}

export function saveLayoutPatch(patch: Partial<CerebralLayoutV1>): void {
  const prev = loadLayout() ?? { v: 1 }
  const next: CerebralLayoutV1 = { ...prev, v: 1, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function saveFullLayout( L: CerebralLayoutV1): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...L, v: 1 }))
  } catch {
    // ignore
  }
}
