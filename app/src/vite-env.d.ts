/// <reference types="vite/client" />

import type { CSSProperties, HTMLAttributes, Ref } from 'react'
import type { RaApi, CerebralApi } from '../electron/preload'

declare global {
  interface Window {
    ra: RaApi
    cerebral: CerebralApi
    /** @deprecated Pre-rename global; use `cerebral`. */
    cerbral?: CerebralApi
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      /** Electron embedded guest; requires `webviewTag: true` in BrowserWindow. */
      webview: HTMLAttributes<HTMLElement> & {
        src?: string
        allowpopups?: string
        style?: CSSProperties
        ref?: Ref<HTMLElement>
      }
    }
  }
}

export {}
