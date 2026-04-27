import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useResonantAgents } from '../../providers/ResonantAgentsProvider'

type TabDef = { to: string; end?: boolean; label: string; mono?: boolean }

export function IDEWorkspaceTabs(): ReactNode {
  const { activeAgent } = useResonantAgents()

  const tabs: TabDef[] = useMemo(
    () => [
      { to: '/app', end: true, label: activeAgent ? `${activeAgent.name}.chat` : 'Agent.chat', mono: true },
      { to: '/app/swarm', label: 'Swarm: Build Pipeline', mono: true },
      { to: '/app/providers', label: 'Providers', mono: true },
      { to: '/app/memory', label: 'Memory', mono: true },
      { to: '/app/approvals', label: 'Tool Approvals', mono: true },
      { to: '/app/logs', label: 'Logs', mono: true },
      { to: '/app/reports', label: 'Report.md', mono: true }
    ],
    [activeAgent]
  )

  return (
    <div className="cide-tabs" role="tablist" aria-label="Workspace">
      {tabs.map((t) => (
        <NavLink
          key={t.to + String(t.end)}
          to={t.to}
          end={t.end}
          className={({ isActive }) => (isActive ? 'cide-tab-on' : undefined)}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
