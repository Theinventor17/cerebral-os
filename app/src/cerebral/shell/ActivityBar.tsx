import type { ReactNode } from 'react'
import { useCerebralLayout } from '../context/CerebralTabContext'
import type { CerebralActivityId } from '../types/cerebral.ts'

const IT: { id: CerebralActivityId; ico: string; title: string }[] = [
  { id: 'explorer', ico: '▤', title: 'Explorer' },
  { id: 'agents', ico: '◇', title: 'Agents' },
  { id: 'swarms', ico: '⬡', title: 'Swarms' },
  { id: 'skills', ico: '✦', title: 'Skills' },
  { id: 'providers', ico: '◫', title: 'Providers' },
  { id: 'memory', ico: '▣', title: 'Memory' },
  { id: 'logs', ico: '≋', title: 'Logs' },
  { id: 'settings', ico: '⛭', title: 'Settings' }
]

export function ActivityBar(): ReactNode {
  const { activity, setActivity } = useCerebralLayout()
  return (
    <nav className="cos-activity" aria-label="Activity bar">
      {IT.map((x) => (
        <button
          key={x.id}
          type="button"
          title={x.title}
          className={activity === x.id ? 'cos-act-on' : undefined}
          onClick={() => setActivity(x.id)}
        >
          {x.ico}
        </button>
      ))}
    </nav>
  )
}
