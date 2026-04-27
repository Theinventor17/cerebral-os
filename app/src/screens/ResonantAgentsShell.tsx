import type { ReactNode } from 'react'
import { ResonantAgentsProvider } from '../providers/ResonantAgentsProvider'
import { CerebralIDELayout } from '../components/ide/CerebralIDELayout'

export function ResonantAgentsShell(): ReactNode {
  return (
    <ResonantAgentsProvider>
      <CerebralIDELayout />
    </ResonantAgentsProvider>
  )
}
