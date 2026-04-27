import type { NormalizedEEGFrame } from '@/cerebral/headsets/HeadsetAdapter'
import type { InsightChannelId } from './insightBrainLayout'

export type InsightBrainVisualizerProps = {
  deviceName: string
  hasLiveData: boolean
  contactQuality?: Record<string, number | string>
  signalQuality?: number | null
  bandPower?: {
    theta?: number
    alpha?: number
    betaL?: number
    betaH?: number
    gamma?: number
  }
  rawChannels?: Record<string, number>
  metrics?: {
    focus?: number
    relaxation?: number
    engagement?: number
    stress?: number
    excitement?: number
    interest?: number
  }
  mentalCommand?: {
    action?: string
    power?: number
  }
}

/** Map Cortex eeg ch1..ch5 to named Insight sites (5‑channel order). */
export const INSIGHT_EEG_KEY_TO_ID: Readonly<Record<`ch${1 | 2 | 3 | 4 | 5}`, InsightChannelId>> = {
  ch1: 'AF3',
  ch2: 'AF4',
  ch3: 'T7',
  ch4: 'T8',
  ch5: 'Pz'
} as const

const CONTACT_KEY_ALIASES: Readonly<Record<InsightChannelId, readonly string[]>> = {
  AF3: ['AF3', 'Ch1', 'ch1', '0', 'EEG0'],
  AF4: ['AF4', 'Ch2', 'ch2', '1', 'EEG1'],
  T7: ['T7', 'Ch3', 'ch3', '2', 'EEG2'],
  T8: ['T8', 'Ch4', 'ch4', '3', 'EEG3'],
  Pz: ['Pz', 'P7', 'Ch5', 'ch5', '4', 'EEG4']
}

export function nrm(n: number | undefined | null): number {
  if (n == null || Number.isNaN(n)) {
    return 0
  }
  const x = Math.abs(n)
  if (x <= 1) {
    return x
  }
  if (x <= 100) {
    return Math.min(1, x / 100)
  }
  return Math.min(1, Math.log10(1 + x) / 4)
}

/** 0 = muted/unknown, 1 = good (green), 2 = warn (amber), 3 = bad (red) */
export type NodeQuality = 0 | 1 | 2 | 3

export function contactForChannel(
  contactQuality: Record<string, number | string> | undefined,
  ch: InsightChannelId
): number | null {
  if (!contactQuality) {
    return null
  }
  const keys = CONTACT_KEY_ALIASES[ch]
  for (const k of keys) {
    if (k in contactQuality) {
      const v = contactQuality[k]
      const num = typeof v === 'number' ? v : Number(String(v).trim())
      if (!Number.isNaN(num)) {
        return num > 1 && num <= 100 ? num / 100 : num <= 1 ? num : num / 100
      }
    }
  }
  return null
}

export function classFromContactAndSignal(
  q: number | null,
  signalQuality: number | null | undefined
): NodeQuality {
  if (q != null) {
    if (q >= 0.75) {
      return 1
    }
    if (q >= 0.4) {
      return 2
    }
    return 3
  }
  if (signalQuality != null) {
    if (signalQuality >= 0.6) {
      return 1
    }
    if (signalQuality >= 0.35) {
      return 2
    }
    if (signalQuality < 0.2) {
      return 3
    }
  }
  return 0
}

export function rawForChannel(
  rawChannels: Record<string, number> | undefined,
  chIndex: 1 | 2 | 3 | 4 | 5
): number | null {
  if (!rawChannels) {
    return null
  }
  const k = `ch${chIndex}` as const
  const v = rawChannels[k]
  if (v == null || Number.isNaN(v)) {
    return null
  }
  return v
}

/**
 * Map latest headset frame to visualizer props. Does not fabricate metrics or raw values.
 */
export function buildInsightVizProps(
  deviceName: string,
  frame: NormalizedEEGFrame | null,
  hasLiveData: boolean
): InsightBrainVisualizerProps {
  if (!frame || !hasLiveData) {
    return {
      deviceName,
      hasLiveData: false,
      contactQuality: undefined,
      signalQuality: null,
      bandPower: undefined,
      rawChannels: undefined,
      metrics: undefined,
      mentalCommand: undefined
    }
  }

  const {
    contactQuality: cq,
    signalQuality: sq,
    bandPower: bp,
    channels,
    metrics: met,
    mentalCommand: mc
  } = frame

  const contactQuality: Record<string, number | string> | undefined = cq
    ? (Object.fromEntries(
        Object.entries(cq).map(([k, v]) => [k, v])
      ) as Record<string, number | string>)
    : undefined

  const rawChannels: Record<string, number> | undefined = channels
    ? { ...channels }
    : undefined

  return {
    deviceName: frame.deviceName || deviceName,
    hasLiveData: true,
    ...(contactQuality ? { contactQuality } : {}),
    signalQuality: sq == null ? null : sq,
    ...(bp && Object.keys(bp).length ? { bandPower: { ...bp } } : {}),
    ...(rawChannels ? { rawChannels } : {}),
    ...(met && Object.keys(met).length
      ? {
          metrics: { ...met }
        }
      : {}),
    ...(mc?.action != null || mc?.power != null
      ? {
          mentalCommand: {
            ...(mc.action != null ? { action: mc.action } : {}),
            ...(mc.power != null ? { power: mc.power } : {})
          }
        }
      : {})
  }
}

/** Combined band “energy” 0..1 for global aura animation when live. */
export function totalBandActivity(bp: InsightBrainVisualizerProps['bandPower']): number {
  if (!bp) {
    return 0
  }
  return (
    nrm(bp.theta) * 0.2 +
    nrm(bp.alpha) * 0.25 +
    nrm(bp.betaL) * 0.2 +
    nrm(bp.betaH) * 0.2 +
    nrm(bp.gamma) * 0.2
  )
}
