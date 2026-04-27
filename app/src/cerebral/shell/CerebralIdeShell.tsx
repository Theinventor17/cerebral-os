import type { ReactNode } from 'react'
import { CerebralTabProvider } from '../context/CerebralTabContext'
import '../styles/cerebral-ide.css'
import '@/styles/resonant-agents.css'
import { RAPermissionGateModal } from '@/components/RAPermissionGateModal'
import { IdeDockLayout } from './IdeDockLayout'
import { CerebralModalLayer } from './CerebralModalLayer'

export function CerebralIdeShell(): ReactNode {
  return (
    <CerebralTabProvider>
      <div className="cos-root cos-ide" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100vh' }}>
        <IdeDockLayout />
        <CerebralModalLayer />
        <RAPermissionGateModal />
      </div>
    </CerebralTabProvider>
  )
}
