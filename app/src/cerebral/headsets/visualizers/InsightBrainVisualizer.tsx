import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'
import {
  buildInsightVizProps,
  classFromContactAndSignal,
  contactForChannel,
  nrm,
  rawForChannel,
  totalBandActivity,
  type InsightBrainVisualizerProps
} from './brainSignalMapping'
import {
  BRAIN_FISSURE_D,
  BRAIN_OUTLINE_D,
  BRAIN_SULCI_PATHS,
  INSIGHT_ELECTRODES,
  INSIGHT_FLOW_EDGES,
  INSIGHT_SVG_VIEWBOX,
  type InsightChannelId
} from './insightBrainLayout'
import './InsightBrainVisualizer.css'

export type { InsightBrainVisualizerProps } from './brainSignalMapping'

const VB_W = INSIGHT_SVG_VIEWBOX.w
const VB_H = INSIGHT_SVG_VIEWBOX.h

function flowCurvePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const mx = (x1 + x2) * 0.5 + -dy * 0.12
  const my = (y1 + y2) * 0.5 + dx * 0.1
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`
}

type DominantBand = 'theta' | 'alpha' | 'beta' | 'gamma' | 'none'

function dominantBand(
  bp: NonNullable<InsightBrainVisualizerProps['bandPower']>
): DominantBand {
  const t = nrm(bp.theta) * 1.0
  const a = nrm(bp.alpha) * 0.95
  const b = (nrm(bp.betaL) + nrm(bp.betaH)) * 0.5
  const g = nrm(bp.gamma) * 0.95
  const m = Math.max(t, a, b, g)
  if (m < 0.04) {
    return 'none'
  }
  if (m === t) {
    return 'theta'
  }
  if (m === a) {
    return 'alpha'
  }
  if (m === b) {
    return 'beta'
  }
  return 'gamma'
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) {
    return '—'
  }
  const p = n <= 1 ? n * 100 : n
  return `${Math.min(100, Math.round(p))}%`
}

function fmtNum(n: number | null | undefined, digits: number = 0): string {
  if (n == null || Number.isNaN(n)) {
    return '—'
  }
  return n.toFixed(digits)
}

export function InsightBrainVisualizer({
  deviceName,
  hasLiveData,
  contactQuality: cq,
  signalQuality: sq,
  bandPower: bp,
  rawChannels: raw,
  metrics: met,
  mentalCommand: mc,
  compact,
  className
}: InsightBrainVisualizerProps & {
  compact?: boolean
  className?: string
}): ReactNode {
  const [hover, setHover] = useState<InsightChannelId | null>(null)
  const [locked, setLocked] = useState<InsightChannelId | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; ch: InsightChannelId } | null>(null)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const domBand = (hasLiveData && bp && dominantBand(bp)) || 'none'

  const nodes = useMemo(() => {
    return INSIGHT_ELECTRODES.map((e) => {
      const c = contactForChannel(cq, e.id)
      const q = classFromContactAndSignal(
        c,
        sq == null ? null : sq <= 1 ? sq : Math.min(1, sq / 100)
      )
      const v = raw ? rawForChannel(raw, e.chIndex) : null
      const vAbs = v != null && !Number.isNaN(v) ? Math.abs(v) : 0
      const rCore = 9 + 12 * nrm(vAbs / 1500) * (hasLiveData ? 1 : 0.45)
      const rAura = rCore + 4 + 10 * (hasLiveData ? totalBandActivity(bp) : 0.08)
      return { ...e, q, rCore, rAura, raw: v, c }
    })
  }, [cq, sq, raw, bp, hasLiveData])

  const focusFront = nrm(met?.focus) * (hasLiveData ? 1 : 0)
  const relax = nrm(met?.relaxation)
  const engage = nrm(met?.engagement)

  const onNodeEnter = useCallback(
    (ch: InsightChannelId, e: React.MouseEvent) => {
      if (tipTimer.current) {
        clearTimeout(tipTimer.current)
      }
      setHover(ch)
      setTip({ x: e.clientX + 12, y: e.clientY + 4, ch })
    },
    []
  )
  const onNodeMove = useCallback(
    (ch: InsightChannelId, e: React.MouseEvent) => {
      if (hover === ch || !hover) {
        setTip((t) => (t && t.ch === ch ? { x: e.clientX + 12, y: e.clientY + 4, ch } : t))
      }
    },
    [hover]
  )
  const onNodeLeave = useCallback(() => {
    tipTimer.current = setTimeout(() => {
      setTip(null)
      setHover(null)
    }, 80)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLocked(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onNodeClick = useCallback(
    (ch: InsightChannelId) => {
      setLocked((l) => (l === ch ? null : ch))
    },
    []
  )

  const lockDetail = useMemo(() => {
    if (!locked) {
      return null
    }
    const e = nodes.find((n) => n.id === locked)
    if (!e) {
      return null
    }
    return e
  }, [locked, nodes])

  const statusText = (() => {
    if (!hasLiveData) {
      return 'No live Insight stream — connect Cortex and subscribe to pow, eeg, and met. Idle preview: outline and soft motion only (no sensor values).'
    }
    const sigN = sq == null ? null : sq <= 1 ? sq : Math.min(1, sq / 100)
    if (sigN != null && sigN < 0.28) {
      return `Live · ${deviceName} — weak contact/signal. Subscribed data only (no fabricated values).`
    }
    return `Connected · live · ${deviceName}.`
  })()

  const rootCls = [
    'insight-brain',
    hasLiveData ? 'insight-brain--live' : 'insight-brain--idle',
    compact && 'insight-brain--compact',
    engage > 0.4 && 'insight-brain--engaged',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootCls}>
      {!compact && (
        <div className="insight-brain__legends" aria-label="Band legend">
          <div className="insight-brain__legend-t">Bands</div>
          <div className="insight-brain__band">
            <span className="insight-brain__band-dot insight-brain__band--theta" />
            θ Theta
          </div>
          <div className="insight-brain__band">
            <span className="insight-brain__band-dot insight-brain__band--alpha" />
            α Alpha
          </div>
          <div className="insight-brain__band">
            <span className="insight-brain__band-dot insight-brain__band--beta" />
            β Beta
          </div>
          <div className="insight-brain__band">
            <span className="insight-brain__band-dot insight-brain__band--gamma" />
            γ Gamma
          </div>
        </div>
      )}
      {compact && (
        <div className="insight-brain__legends" aria-label="Band legend (compact)">
          <div className="insight-brain__band" title="θ">
            <span className="insight-brain__band-dot insight-brain__band--theta" />θ
          </div>
          <div className="insight-brain__band" title="α">
            <span className="insight-brain__band-dot insight-brain__band--alpha" />α
          </div>
          <div className="insight-brain__band" title="β">
            <span className="insight-brain__band-dot insight-brain__band--beta" />β
          </div>
          <div className="insight-brain__band" title="γ">
            <span className="insight-brain__band-dot insight-brain__band--gamma" />γ
          </div>
        </div>
      )}

      <div className="insight-brain__svg-wrap">
        <div
          className={`insight-brain__aura${relax > 0.35 && hasLiveData ? ' insight-brain__aura--relaxed' : ''}`}
          aria-hidden
        />
        <svg
          className="insight-brain__svg"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          role="img"
          aria-label="EMOTIV Insight neural activity map"
        >
          <defs>
            <linearGradient id="ib-flow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9b5cff" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#18c7ff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#2d6bff" stopOpacity="0.35" />
            </linearGradient>
            <radialGradient id="ib-focus-grad" cx="50%" cy="0%" r="60%">
              <stop offset="0%" stopColor="#6ee7ff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
            <filter id="ib-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="0.3 0 0 0 0  0.45 0 0 0 0  0.6 0 0 0 0  0 0 0 0.6 0"
                result="c"
              />
              <feMerge>
                <feMergeNode in="c" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ib-node-gray" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="0.4" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="0.25 0 0 0 0  0.28 0 0 0 0  0.32 0 0 0 0  0 0 0 0.4 0"
                result="g"
              />
              <feMerge>
                <feMergeNode in="g" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ib-node-good" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="0.2 0 0 0 0.05  0.95 0 0 0 0.15  0.55 0 0 0 0.1  0 0 0 0.55 0"
                result="g"
              />
              <feMerge>
                <feMergeNode in="g" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ib-node-warn" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="0.4 0 0 0 0.1  0.35 0 0 0 0.05  0.15 0 0 0 0  0 0 0 0.5 0"
                result="g"
              />
              <feMerge>
                <feMergeNode in="g" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ib-node-bad" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.9" result="b" />
              <feColorMatrix
                in="b"
                type="matrix"
                values="0.4 0 0 0 0.1  0.12 0 0 0 0  0.12 0 0 0 0  0 0 0 0.45 0"
                result="g"
              />
              <feMerge>
                <feMergeNode in="g" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {hasLiveData && focusFront > 0.08 && (
            <ellipse
              className="insight-brain__focus-front"
              cx="400"
              cy="120"
              rx="140"
              ry="64"
              style={{ opacity: 0.12 + 0.38 * focusFront }}
            />
          )}

          <path d={BRAIN_OUTLINE_D} className="insight-brain__outline" />
          {BRAIN_SULCI_PATHS.map((d, i) => (
            <path key={i} d={d} className="insight-brain__sulcus" />
          ))}
          <path d={BRAIN_FISSURE_D} className="insight-brain__fissure" />

          {INSIGHT_FLOW_EDGES.map(([a, b], i) => {
            const na = nodes.find((n) => n.id === a)
            const nb = nodes.find((n) => n.id === b)
            if (!na || !nb) {
              return null
            }
            return (
              <path
                key={`${a}-${b}-${i}`}
                d={flowCurvePath(na.x, na.y, nb.x, nb.y)}
                className="insight-brain__flow"
                style={
                  { strokeDasharray: '6 8', WebkitMaskImage: 'none' } as CSSProperties
                }
              />
            )
          })}

          {nodes.map((n) => {
            const tint = hasLiveData && domBand !== 'none' && n.q > 0
            const tcls =
              domBand === 'theta'
                ? 'insight-brain__node-tint--theta'
                : domBand === 'alpha'
                  ? 'insight-brain__node-tint--alpha'
                  : domBand === 'beta'
                    ? 'insight-brain__node-tint--beta'
                    : 'insight-brain__node-tint--gamma'
            return (
              <g
                key={n.id}
                onMouseEnter={(ev) => onNodeEnter(n.id, ev)}
                onMouseMove={(ev) => onNodeMove(n.id, ev)}
                onMouseLeave={onNodeLeave}
                onClick={() => onNodeClick(n.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onNodeClick(n.id)
                  }
                }}
              >
                {tint && (
                  <circle
                    className={`insight-brain__node-aura ${tcls}${
                      hasLiveData && n.raw != null && vAbsFlicker(n.raw) ? ' insight-brain__flick' : ''
                    }`}
                    cx={n.x}
                    cy={n.y}
                    r={n.rAura}
                    fill="none"
                    strokeWidth={1.2}
                    opacity={0.4 + 0.35 * (bp ? totalBandActivity(bp) : 0)}
                  />
                )}
                <circle
                  className={`insight-brain__node insight-brain__node--q${n.q}`}
                  cx={n.x}
                  cy={n.y}
                  r={n.rCore}
                />
                <text
                  x={n.x + 14}
                  y={n.y + 4}
                  className="insight-brain__node-label"
                  style={{ userSelect: 'none' } as CSSProperties}
                >
                  {n.id}
                </text>
              </g>
            )
          })}
        </svg>
        {tip && hover && (
          <div
            className="insight-brain__tip"
            style={{ left: tip.x, top: tip.y, maxWidth: compact ? 200 : 240 }}
            role="tooltip"
          >
            <NodeTooltip
              ch={tip.ch}
              node={nodes.find((n) => n.id === tip.ch)}
              hasLiveData={hasLiveData}
              bp={bp}
              met={met}
            />
          </div>
        )}
      </div>

      <div className="insight-brain__metrics" aria-label="Headset metrics">
        <div className="insight-brain__metric">
          <b>Focus</b> <span>{met?.focus == null || !hasLiveData ? '—' : fmtPct(met.focus)}</span>
        </div>
        <div className="insight-brain__metric">
          <b>Relaxation</b> <span>{met?.relaxation == null || !hasLiveData ? '—' : fmtPct(met.relaxation)}</span>
        </div>
        <div className="insight-brain__metric">
          <b>Engagement</b> <span>{met?.engagement == null || !hasLiveData ? '—' : fmtPct(met.engagement)}</span>
        </div>
        <div className="insight-brain__metric">
          <b>Signal</b> <span>{!hasLiveData ? '—' : fmtPct(sq == null ? null : sq <= 1 ? sq : Math.min(1, sq / 100))}</span>
        </div>
        {mc?.action && hasLiveData && (
          <div className="insight-brain__metric" style={{ gridColumn: '1 / -1' }}>
            <b>com</b>{' '}
            <span>
              {mc.action} {mc.power == null ? '' : fmtPct(mc.power)}
            </span>
          </div>
        )}
      </div>

      {lockDetail ? (
        <div className="insight-brain__details">
          <button type="button" className="insight-brain__close-details" onClick={() => setLocked(null)}>
            Close
          </button>
          <h4>{lockDetail.id}</h4>
          <dl>
            <dt>Contact (when provided)</dt>
            <dd>{lockDetail.c == null || !hasLiveData ? '—' : fmtPct(lockDetail.c)}</dd>
            <dt>Raw (ch{lockDetail.chIndex})</dt>
            <dd>{lockDetail.raw == null || !hasLiveData ? '—' : fmtNum(lockDetail.raw, 1)}</dd>
            <dt>Band influence</dt>
            <dd>{!hasLiveData || !bp ? '—' : bandInfluenceText(bp, domBand)}</dd>
            <dt>Device</dt>
            <dd>{deviceName}</dd>
          </dl>
        </div>
      ) : (
        <div className="insight-brain__details--empty" aria-hidden />
      )}

      <div className="insight-brain__footer">
        <div className="insight-brain__status" role="status">
          {statusText}
        </div>
        {!hasLiveData && (
          <p className="insight-brain__idle-note">Idle preview — no fabricated sensor values.</p>
        )}
        <p className="insight-brain__message">
          Streams: use Cortex subscribe for <code>eeg</code>, <code>pow</code>, <code>met</code>, and <code>dev</code> (contact) when
          your license allows.
        </p>
      </div>
    </div>
  )
}

function vAbsFlicker(raw: number): boolean {
  return Math.abs(raw) > 8
}

function bandInfluenceText(
  bp: NonNullable<InsightBrainVisualizerProps['bandPower']>,
  d: DominantBand
): string {
  if (d === 'none') {
    return 'mixed / low'
  }
  const parts = [
    nrm(bp.theta) > 0.02 ? `θ ${(nrm(bp.theta) * 100).toFixed(0)}%` : null,
    nrm(bp.alpha) > 0.02 ? `α ${(nrm(bp.alpha) * 100).toFixed(0)}%` : null,
    nrm(bp.betaL) + nrm(bp.betaH) > 0.02
      ? `β ${(nrm(bp.betaL) * 100).toFixed(0)}% / ${(nrm(bp.betaH) * 100).toFixed(0)}%`
      : null,
    nrm(bp.gamma) > 0.02 ? `γ ${(nrm(bp.gamma) * 100).toFixed(0)}%` : null
  ].filter(Boolean)
  return `Dominant: ${d} · ${parts.join(' · ')}`
}

type NodeRow = (typeof INSIGHT_ELECTRODES)[number] & {
  q: 0 | 1 | 2 | 3
  rCore: number
  rAura: number
  raw: number | null
  c: number | null
}

function NodeTooltip({
  ch,
  node,
  hasLiveData,
  bp,
  met
}: {
  ch: InsightChannelId
  node: NodeRow | undefined
  hasLiveData: boolean
  bp: InsightBrainVisualizerProps['bandPower']
  met: InsightBrainVisualizerProps['metrics']
}): ReactNode {
  if (!node) {
    return null
  }
  return (
    <div>
      <strong style={{ color: 'var(--cyan, #18c7ff)' }}>{ch}</strong>
      <br />
      Contact: {node.c == null || !hasLiveData ? '—' : fmtPct(node.c)}
      <br />
      Raw: {node.raw == null || !hasLiveData ? '—' : fmtNum(node.raw, 1)}
      <br />
      Met: f {met?.focus == null || !hasLiveData ? '—' : fmtPct(met.focus)} / r{' '}
      {met?.relaxation == null || !hasLiveData ? '—' : fmtPct(met.relaxation)}
      <br />
      Pow: {bp && hasLiveData ? bandInfluenceText(bp, dominantBand(bp)) : '—'}
    </div>
  )
}

export function InsightBrainVisualizerLive({
  deviceName: deviceNameP,
  compact,
  className
}: {
  deviceName?: string
  compact?: boolean
  className?: string
}): ReactNode {
  const { eegVizFrameRef, insightLive, headset, signalLock } = useResonantAgents()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100)
    return () => clearInterval(id)
  }, [])

  const name = deviceNameP ?? (headset && headset !== '—' ? headset : 'EMOTIV Insight')

  const props = useMemo(() => {
    const frame = eegVizFrameRef.current
    const b = buildInsightVizProps(name, frame, insightLive)
    if (b.signalQuality == null && signalLock != null) {
      const s = signalLock
      const n = s <= 1 ? s : Math.min(1, s / 100)
      return { ...b, signalQuality: n }
    }
    return b
  }, [tick, name, insightLive, signalLock])

  return <InsightBrainVisualizer {...props} deviceName={name} compact={compact} className={className} />
}
