import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { RAPermissionGateModal } from '../RAPermissionGateModal'
import '../../styles/cerebral-ide.css'
import { IDEBottomPanel } from './IDEBottomPanel'
import { IDEActivityBar } from './IDEActivityBar'
import { IDEExplorerPanel } from './IDEExplorerPanel'
import { IDERightInspector } from './IDERightInspector'
import { IDETitleBar } from './IDETitleBar'
import { IDEWorkspaceTabs } from './IDEWorkspaceTabs'

export function CerebralIDELayout(): ReactNode {
  return (
    <div className="cide-root">
      <IDETitleBar />
      <div className="cide-mid">
        <IDEActivityBar />
        <IDEExplorerPanel />
        <div className="cide-center">
          <IDEWorkspaceTabs />
          <div className="cide-work">
            <div className="cide-work-inner">
              <Outlet />
            </div>
          </div>
        </div>
        <IDERightInspector />
      </div>
      <IDEBottomPanel />
      <RAPermissionGateModal />
    </div>
  )
}
