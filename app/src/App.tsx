import type { ReactNode } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { ResonantAgentsProvider } from './providers/ResonantAgentsProvider'
import { CommandExecutionProvider } from './providers/CommandExecutionProvider'
import { NeuralThoughtProvider } from './providers/NeuralThoughtProvider'
import { CerebralIdeShell } from './cerebral/shell/CerebralIdeShell'
import { CerebralWelcome } from './cerebral/welcome/CerebralWelcome'

export function App(): ReactNode {
  return (
    <ResonantAgentsProvider>
      <CommandExecutionProvider>
      <NeuralThoughtProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/cerebral/welcome" replace />} />
        <Route path="/app/*" element={<Navigate to="/cerebral/welcome" replace />} />
        <Route path="/cerebral/welcome" element={<CerebralWelcome />} />
        <Route path="/cerebral/ide" element={<CerebralIdeShell />} />
        <Route path="/cerebral" element={<Navigate to="/cerebral/welcome" replace />} />
      </Routes>
      </NeuralThoughtProvider>
      </CommandExecutionProvider>
    </ResonantAgentsProvider>
  )
}
