import type { ReactNode } from 'react'
import type { ResonantAgent } from '../types'

const sym: Record<string, string> = {
  heart: '◆',
  tree: '▣',
  cube: '⬡',
  eye: '◎',
  star: '✦',
  network: '⎔',
  shield: '⛨'
}

/** Agent identity uses icon only — no per-agent rainbow fills (unified neural gradient system). */
export function RAAvatar({
  agent,
  size = 48,
  className
}: {
  agent: Pick<ResonantAgent, 'name' | 'icon'>
  size?: number
  className?: string
}): ReactNode {
  const c = sym[agent.icon] ?? '◈'
  return (
    <div
      className={`ra-av ${className ?? ''}`.trim()}
      style={{
        width: size,
        height: size,
        minWidth: size,
        fontSize: Math.round(size * 0.38)
      }}
    >
      {c}
    </div>
  )
}

export function RANeuralLogo() {
  return (
    <div className="ra-logo-icon" aria-hidden>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ra-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#18C7FF" />
            <stop offset="38%" stopColor="#2D6BFF" />
            <stop offset="100%" stopColor="#9B5CFF" />
          </linearGradient>
          <filter id="ra-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="22" cy="10" r="4" fill="url(#ra-grad)" filter="url(#ra-glow)" />
        <circle cx="10" cy="30" r="3" fill="url(#ra-grad)" opacity="0.95" />
        <circle cx="34" cy="30" r="3" fill="url(#ra-grad)" opacity="0.95" />
        <path
          d="M22 16v6M12 25l-4 2.5M32 25l4 2.5"
          stroke="url(#ra-grad)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path d="M22 22v12" stroke="url(#ra-grad)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  )
}
