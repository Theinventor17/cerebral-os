import type {
  HeadsetAdapter,
  HeadsetDeviceProfile,
  InsightFeatureSnapshot,
  IntentV1Result,
  NormalizedEEGFrame
} from './HeadsetAdapter'
import type { ThoughtCommandName } from '@/types'

export const EMOTIV_INSIGHT_PROFILE: HeadsetDeviceProfile = {
  id: 'emotiv_insight',
  name: 'EMOTIV Insight',
  channels: 5,
  api: 'EMOTIV Cortex API',
  supportedStreams: ['eeg', 'pow', 'met', 'com', 'dev']
}

type JsonObj = Record<string, unknown>

function n(x: unknown): number | null {
  if (typeof x === 'number' && !Number.isNaN(x)) {
    return x
  }
  if (typeof x === 'string' && x.trim() !== '' && !Number.isNaN(Number(x))) {
    return Number(x)
  }
  return null
}

/**
 * Picks a numeric from EMOTIV met-style objects (varies by build / license).
 * Does not invent values: only returns a number if a plausible key is present.
 */
function pickMet(met: JsonObj, ...keys: string[]): number | null {
  for (const k of keys) {
    if (k in met) {
      const v = n(met[k])
      if (v != null) {
        return clamp01(v)
      }
    }
  }
  return null
}

function clamp01(v: number): number {
  if (v > 1 && v <= 100) {
    return v / 100
  }
  if (v < 0) {
    return 0
  }
  if (v > 1) {
    return 1
  }
  return v
}

function parseMentalCom(com: unknown): { action?: string; power?: number } | undefined {
  if (!com || typeof com !== 'object') {
    return undefined
  }
  if (Array.isArray(com)) {
    return undefined
  }
  const o = com as JsonObj
  const keys = Object.keys(o).filter((k) => n(o[k]) != null)
  if (keys.length === 0) {
    return undefined
  }
  let bestK = keys[0]
  let bestV = n(o[bestK]) ?? 0
  for (const k of keys) {
    const v = n(o[k]) ?? 0
    if (v > bestV) {
      bestK = k
      bestV = v
    }
  }
  return { action: bestK, power: clamp01(bestV) }
}

/**
 * One Cortex stream payload (often a full JSON line with eeg, met, pow, com, or dev).
 * Returns `null` if there is no measurable signal in this packet (avoids empty fabricated frames).
 */
export function parseCortexStreamData(deviceId: string, deviceName: string, data: unknown): NormalizedEEGFrame | null {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }
  const d = data as JsonObj
  const ts = n(d['time']) ?? Date.now()

  const metRaw = d['met']
  let metrics: NormalizedEEGFrame['metrics'] | undefined
  if (metRaw && typeof metRaw === 'object' && !Array.isArray(metRaw)) {
    const met = metRaw as JsonObj
    const focus = pickMet(met, 'foc', 'focus', 'att', 'attention')
    const relaxation = pickMet(met, 'rel', 'relaxation', 'med', 'meditation')
    const engagement = pickMet(met, 'eng', 'engagement')
    const stress = pickMet(met, 'str', 'stress', 'st')
    const excitement = pickMet(met, 'exc', 'excitement')
    const interest = pickMet(met, 'int', 'interest', 'i')
    if (focus != null || relaxation != null || engagement != null || stress != null || excitement != null || interest != null) {
      metrics = {}
      if (focus != null) {
        metrics.focus = focus
      }
      if (relaxation != null) {
        metrics.relaxation = relaxation
      }
      if (engagement != null) {
        metrics.engagement = engagement
      }
      if (stress != null) {
        metrics.stress = stress
      }
      if (excitement != null) {
        metrics.excitement = excitement
      }
      if (interest != null) {
        metrics.interest = interest
      }
    }
  }

  let eeg: number[] | undefined
  if (Array.isArray(d['eeg']) && d['eeg'].every((x) => typeof x === 'number' || (typeof x === 'string' && !Number.isNaN(Number(x))))) {
    eeg = (d['eeg'] as unknown[]).map((x) => (typeof x === 'number' ? x : Number(x)))
  }
  const channels: Record<string, number> | undefined = eeg
    ? Object.fromEntries(eeg.map((v, i) => [`ch${i + 1}`, v]))
    : undefined

  const pow = d['pow']
  let bandPower: NormalizedEEGFrame['bandPower'] | undefined
  if (pow && typeof pow === 'object' && !Array.isArray(pow)) {
    const p = pow as JsonObj
    const read = (a: string[]) => {
      for (const k of a) {
        const v = n(p[k])
        if (v != null) {
          return v
        }
      }
      return undefined
    }
    const th = read(['theta', 't'])
    const al = read(['alpha', 'a'])
    const bL = read(['betalow', 'beta_l', 'betal', 'lowbeta'])
    const bH = read(['betahigh', 'beta_h', 'betah', 'highbeta'])
    const ga = read(['gamma', 'g'])
    if (th != null || al != null || bL != null || bH != null || ga != null) {
      bandPower = {}
      if (th != null) {
        bandPower.theta = th
      }
      if (al != null) {
        bandPower.alpha = al
      }
      if (bL != null) {
        bandPower.betaL = bL
      }
      if (bH != null) {
        bandPower.betaH = bH
      }
      if (ga != null) {
        bandPower.gamma = ga
      }
    }
  }

  const com = parseMentalCom(d['com'])
  const mentalCommand = com?.action != null ? { action: com.action, power: com.power } : undefined

  const dev = d['dev']
  let battery: number | null = null
  let signalQuality: number | null = null
  let contactQuality: Record<string, number> | undefined
  if (dev && typeof dev === 'object' && !Array.isArray(dev)) {
    const v = n((dev as JsonObj)['battery'])
    if (v != null) {
      battery = v > 1.5 && v <= 100 ? v : v <= 1 ? v : v / 100
    }
    const b = n((dev as JsonObj)['signal'] ?? (dev as JsonObj)['overall'])
    if (b != null) {
      signalQuality = clamp01(b)
    }
    const cq = (dev as JsonObj)['contact']
    if (cq && typeof cq === 'object' && !Array.isArray(cq)) {
      const out: Record<string, number> = {}
      for (const [k, val] of Object.entries(cq as JsonObj)) {
        const num = n(val)
        if (num != null) {
          out[k] = num
        }
      }
      if (Object.keys(out).length) {
        contactQuality = out
        if (signalQuality == null) {
          const xs = Object.values(out)
          signalQuality = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
        }
      }
    }
  }
  if (d['met'] && typeof d['met'] === 'object' && !Array.isArray(d['met'])) {
    const cq = n((d['met'] as JsonObj)['cq'])
    if (cq != null) {
      signalQuality = clamp01(cq)
    }
  }

  if (!metrics && !channels && !bandPower && !mentalCommand && battery == null && signalQuality == null) {
    return null
  }

  return {
    deviceId,
    deviceName,
    timestamp: ts,
    ...(channels ? { channels } : {}),
    ...(bandPower && Object.keys(bandPower).length ? { bandPower } : {}),
    ...(metrics && Object.keys(metrics).length ? { metrics } : {}),
    ...(mentalCommand ? { mentalCommand } : {}),
    battery,
    signalQuality,
    ...(contactQuality ? { contactQuality } : {}),
    raw: data
  }
}

function meanContactQuality(f: NormalizedEEGFrame): number | null {
  const c = f.contactQuality
  if (c) {
    const v = Object.values(c)
    if (v.length) {
      return v.reduce((a, b) => a + b, 0) / v.length
    }
  }
  if (f.signalQuality != null) {
    return f.signalQuality
  }
  return null
}

export function buildInsightFeatureSnapshot(frames: NormalizedEEGFrame[], device: HeadsetDeviceProfile): InsightFeatureSnapshot {
  if (frames.length === 0) {
    return {
      deviceId: device.id,
      deviceName: device.name,
      focusScore: null,
      calmScore: null,
      stressScore: null,
      engagementScore: null,
      signalQuality: null,
      noLiveSignal: true
    }
  }
  const last = frames[frames.length - 1]
  const f = (x: (m: NonNullable<NormalizedEEGFrame['metrics']>) => number | undefined) => {
    const vals = frames.map((fr) => (fr.metrics ? x(fr.metrics) : undefined)).filter((v): v is number => v != null)
    if (!vals.length) {
      return null
    }
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }
  const focus = f((m) => m.focus)
  const calm = f((m) => m.relaxation)
  const stress = f((m) => m.stress)
  const eng = f((m) => m.engagement)
  const sig = (() => {
    const xs = frames.map(meanContactQuality).filter((v): v is number => v != null)
    if (xs.length) {
      return xs.reduce((a, b) => a + b, 0) / xs.length
    }
    return null
  })()
  const hasAny = focus != null || calm != null || stress != null || eng != null || last.channels != null
  return {
    deviceId: last.deviceId,
    deviceName: last.deviceName,
    focusScore: focus,
    calmScore: calm,
    stressScore: stress,
    engagementScore: eng,
    signalQuality: sig,
    noLiveSignal: !hasAny
  }
}

function mapComToCommand(action: string, power: number | undefined): ThoughtCommandName | null {
  const a = action.toLowerCase()
  if ((power ?? 0) < 0.4) {
    return null
  }
  if (a.includes('confirm') || a.includes('push') || a === 'yes') {
    return 'confirm_intent'
  }
  if (a.includes('reject') || a.includes('pull') || a === 'no' || a.includes('disagree')) {
    return 'reject_intent'
  }
  if (a.includes('left') || a.includes('right') || a.includes('switch') || a.includes('rotate')) {
    return 'switch_agent'
  }
  if (a.includes('neutral')) {
    return 'send_message'
  }
  return null
}

const HIGH = 0.72
const LOW_STRESS = 0.35
const STRESS_SPIKE = 0.65
const LOW_SIG = 0.3

/**
 * v1 heuristics on Insight features; mental command wins when over threshold.
 */
export function computeIntentV1(
  last: NormalizedEEGFrame | null,
  history: NormalizedEEGFrame[],
  prev: InsightFeatureSnapshot | null
): IntentV1Result {
  if (!last) {
    return {
      command: null,
      confidence: 0,
      signalQuality: null,
      source: 'none',
      reason: 'no frame',
      metricsForStorage: null
    }
  }
  const feat = buildInsightFeatureSnapshot(history.length ? history : [last], EMOTIV_INSIGHT_PROFILE)
  const qual = last.signalQuality ?? feat.signalQuality
  const mcom = last.mentalCommand
  if (mcom?.action && (mcom.power ?? 0) >= 0.45) {
    const cmd = mapComToCommand(mcom.action, mcom.power)
    if (cmd) {
      return {
        command: cmd,
        confidence: Math.min(0.99, 0.55 + (mcom.power ?? 0) * 0.4),
        signalQuality: qual,
        source: 'mental_command',
        reason: `com:${mcom.action}`,
        metricsForStorage: { mentalCommand: mcom, signalQuality: qual }
      }
    }
  }
  if (feat.noLiveSignal) {
    return {
      command: null,
      confidence: 0,
      signalQuality: qual,
      source: 'none',
      reason: 'no live signal',
      metricsForStorage: { noLiveSignal: true }
    }
  }
  if (qual != null && qual < LOW_SIG) {
    return {
      command: 'reject_intent',
      confidence: 0.45,
      signalQuality: qual,
      source: 'heuristic',
      reason: 'unstable signal',
      metricsForStorage: { signalQuality: qual, focus: feat.focusScore, stress: feat.stressScore }
    }
  }
  const f = last.metrics?.focus ?? feat.focusScore
  const s = last.metrics?.stress ?? feat.stressScore
  const r = last.metrics?.relaxation ?? feat.calmScore
  const e = last.metrics?.engagement ?? feat.engagementScore
  const fPrev = prev?.focusScore
  const sPrev = prev?.stressScore
  const ePrev = prev?.engagementScore
  if (f != null && f > HIGH && qual != null && qual >= 0.5) {
    return {
      command: 'focus_agent',
      confidence: 0.5 + f * 0.2,
      signalQuality: qual,
      source: 'heuristic',
      reason: 'high focus, stable',
      metricsForStorage: { focus: f, stress: s, signalQuality: qual }
    }
  }
  if (f != null && s != null && f > 0.55 && s < LOW_STRESS) {
    return {
      command: 'confirm_intent',
      confidence: 0.45 + f * 0.35,
      signalQuality: qual,
      source: 'heuristic',
      reason: 'focus with low stress',
      metricsForStorage: { focus: f, stress: s, signalQuality: qual }
    }
  }
  if (s != null && s > STRESS_SPIKE && (qual == null || qual < 0.45 || (sPrev != null && s > sPrev + 0.15))) {
    return {
      command: 'reject_intent',
      confidence: 0.4 + s * 0.35,
      signalQuality: qual,
      source: 'heuristic',
      reason: 'stress spike or instability',
      metricsForStorage: { stress: s, stressPrev: sPrev, signalQuality: qual }
    }
  }
  if (e != null && ePrev != null && e > ePrev + 0.1) {
    return {
      command: 'send_message',
      confidence: 0.35 + (e - ePrev) * 2,
      signalQuality: qual,
      source: 'heuristic',
      reason: 'engagement rising — continue',
      metricsForStorage: { engagement: e, prev: ePrev, signalQuality: qual }
    }
  }
  if (r != null && fPrev != null && r > (fPrev ?? 0) + 0.1) {
    return {
      command: 'ask_question',
      confidence: 0.4 + r * 0.2,
      signalQuality: qual,
      source: 'heuristic',
      reason: 'relaxation rising — summarize / slow',
      metricsForStorage: { relaxation: r, focusPrev: fPrev, signalQuality: qual }
    }
  }
  return {
    command: null,
    confidence: 0,
    signalQuality: qual,
    source: 'none',
    reason: 'no rule matched',
    metricsForStorage: { focus: f, stress: s, signalQuality: qual }
  }
}

export const EmotivInsightAdapter: HeadsetAdapter = {
  profile: EMOTIV_INSIGHT_PROFILE,
  normalizeFrame(data: unknown): NormalizedEEGFrame | null {
    return parseCortexStreamData(EMOTIV_INSIGHT_PROFILE.id, EMOTIV_INSIGHT_PROFILE.name, data)
  },
  extractFeatures(frames: NormalizedEEGFrame[]): InsightFeatureSnapshot {
    return buildInsightFeatureSnapshot(frames, EMOTIV_INSIGHT_PROFILE)
  },
  mapIntentV1(last, history, prev) {
    return computeIntentV1(last, history, prev)
  }
}
