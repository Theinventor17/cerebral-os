/**
 * Top-down 2.5D layout for EMOTIV Insight in-app visualizer.
 * viewBox: 0 0 800 420 (spec). Brain body ~520×320 centered; electrodes in absolute coords.
 */

export const INSIGHT_SVG_VIEWBOX = { w: 800, h: 420 } as const

export type InsightChannelId = 'AF3' | 'AF4' | 'T7' | 'T8' | 'Pz'

export type LayoutElectrode = {
  id: InsightChannelId
  /** x,y in user space (0–800, 0–420) */
  x: number
  y: number
  /** eeg ch index 1..5 (Cortex ch1..ch5 order for Insight) */
  chIndex: 1 | 2 | 3 | 4 | 5
  label: string
}

/**
 * User-specified node positions. Ch map: common Cortex 5ch order AF3, AF4, T7, T8, Pz
 * (see `brainSignalMapping.INSIGHT_EEG_KEY_TO_ID`).
 */
export const INSIGHT_ELECTRODES: readonly LayoutElectrode[] = [
  { id: 'AF3', x: 300, y: 125, chIndex: 1, label: 'AF3' },
  { id: 'AF4', x: 500, y: 125, chIndex: 2, label: 'AF4' },
  { id: 'T7', x: 230, y: 225, chIndex: 3, label: 'T7' },
  { id: 'T8', x: 570, y: 225, chIndex: 4, label: 'T8' },
  { id: 'Pz', x: 400, y: 300, chIndex: 5, label: 'Pz' }
] as const

/** Directed pairs for “signal flow” polylines (arrows optional in SVG). */
export const INSIGHT_FLOW_EDGES: readonly [InsightChannelId, InsightChannelId][] = [
  ['AF3', 'T7'],
  ['AF4', 'T8'],
  ['T7', 'Pz'],
  ['T8', 'Pz'],
  ['AF3', 'Pz'],
  ['AF4', 'Pz'],
  ['T7', 'T8'],
  ['AF3', 'AF4']
]

/**
 * Top-down brain silhouette: two-lobe outline (closed path), semi-transparent fill in CSS.
 * Curves tuned so AF3/AF4/T7/T8/Pz sit inside the lobes (~520×320 region around center).
 */
export const BRAIN_OUTLINE_D =
  'M 400 52 C 268 52 138 118 138 218 C 138 318 258 372 400 368 C 542 372 662 318 662 218 C 662 118 532 52 400 52 Z'

/** Midline fissure (rough), from frontal notch toward central sulcus area. */
export const BRAIN_FISSURE_D = 'M 400 58 L 400 228'

/**
 * Suggestive sulci (decorative), low opacity; not anatomically exact.
 * Paths are in same coordinate space; clipped by outline in app if needed.
 */
export const BRAIN_SULCI_PATHS: readonly string[] = [
  'M 255 150 C 220 200 220 250 255 300',
  'M 350 100 C 320 150 320 250 360 300',
  'M 450 100 C 480 150 480 250 440 300',
  'M 545 150 C 580 200 580 250 545 300',
  'M 320 200 C 360 220 400 200 400 200',
  'M 400 200 C 440 200 480 200 480 200'
]

export function getElectrodeById(id: InsightChannelId): LayoutElectrode | undefined {
  return INSIGHT_ELECTRODES.find((e) => e.id === id)
}
