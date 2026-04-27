import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

const ITEMS: { to: string; title: string; ico: string; match?: (path: string) => boolean }[] = [
  {
    to: '/app',
    title: 'Agents',
    ico: '◇',
    match: (p) =>
      p === '/app' ||
      p.startsWith('/app/my-agents') ||
      p.startsWith('/app/session') ||
      p.startsWith('/app/marketplace') ||
      p.startsWith('/app/signal-history') ||
      p.startsWith('/app/image-requests') ||
      p.startsWith('/app/approvals') ||
      p.startsWith('/app/logs') ||
      p.startsWith('/app/reports') ||
      p.startsWith('/app/local-models')
  },
  { to: '/app/sessions', title: 'Sessions', ico: '⎆', match: (p) => p.startsWith('/app/sessions') },
  { to: '/app/swarm', title: 'Swarms', ico: '⬡', match: (p) => p.startsWith('/app/swarm') },
  { to: '/app/providers', title: 'Providers', ico: '◫', match: (p) => p.startsWith('/app/providers') },
  { to: '/app/memory', title: 'Memory', ico: '▣', match: (p) => p.startsWith('/app/memory') },
  { to: '/app/logs', title: 'Logs', ico: '▤', match: (p) => p.startsWith('/app/logs') },
  { to: '/app/settings', title: 'Settings', ico: '⛭', match: (p) => p.startsWith('/app/settings') || p.startsWith('/app/api-keys') }
]

export function IDEActivityBar(): ReactNode {
  const { pathname } = useLocation()
  return (
    <nav className="cide-activity" aria-label="Activity">
      {ITEMS.map((it) => {
        const active = it.match ? it.match(pathname) : pathname === it.to
        return (
          <Link key={it.to} to={it.to} title={it.title} className={active ? 'cide-act-active' : undefined}>
            {it.ico}
          </Link>
        )
      })}
    </nav>
  )
}
