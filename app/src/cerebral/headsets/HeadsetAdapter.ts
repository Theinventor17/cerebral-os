import type { ThoughtCommandName } from '@/types'

/** Normalized per-frame data — only fields present when the source stream provided them. */
export type NormalizedEEGFrame = {
  deviceId: string
  deviceName: string
  timestamp: number
  channels?: Record<string, number>
  bandPower?: {
    theta?: number
    alpha?: number
    betaL?: number
    betaH?: number
    gamma?: number
  }
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
  battery?: number | null
  signalQuality?: number | null
  contactQuality?: Record<string, number>
  raw?: unknown
}

export type HeadsetDeviceProfile = {
  id: string
  name: string
  channels: number
  api: string
  supportedStreams: string[]
}

export type InsightFeatureSnapshot = {
  deviceId: string
  deviceName: string
  focusScore: number | null
  calmScore: number | null
  stressScore: number | null
  engagementScore: number | null
  signalQuality: number | null
  /** No usable metrics / eeg in this window */
  noLiveSignal: boolean
}

export type IntentV1Result = {
  command: ThoughtCommandName | null
  confidence: number
  signalQuality: number | null
  source: 'mental_command' | 'heuristic' | 'none'
  reason: string
  /** Raw or compact metrics for thought_commands.source_metrics_json */
  metricsForStorage: Record<string, unknown> | null
}

export interface HeadsetAdapter {
  readonly profile: HeadsetDeviceProfile
  /** Map one Cortex (or device) message to a frame, or `null` if nothing to emit (do not fabricate). */
  normalizeFrame(data: unknown): NormalizedEEGFrame | null
  /** Map consecutive frames to features used for intent. */
  extractFeatures(frames: NormalizedEEGFrame[]): InsightFeatureSnapshot
  mapIntentV1(
    last: NormalizedEEGFrame | null,
    history: NormalizedEEGFrame[],
    prev: InsightFeatureSnapshot | null
  ): IntentV1Result
}
