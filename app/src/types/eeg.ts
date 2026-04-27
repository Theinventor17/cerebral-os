export type PhaseLabel =
  | 'Searching'
  | 'Locking'
  | 'Receiving'
  | 'Translating'
  | 'Distorted'
  | 'Clear'

export interface PerformanceMetrics {
  eng?: number
  exc?: number
  lex?: number
  str?: number
  rel?: number
  int?: number
  foc?: number
  [key: string]: number | undefined
}

export interface HeadsetInfo {
  id: string
  firmware: string
  status: string
  battery?: number
  /** 0-1 or engine-specific; normalized in processor */
  signalQuality?: number
}

export interface ContactQuality {
  [electrode: string]: number
}

export interface EmotivStreamSnapshot {
  timestamp: string
  /** Performance metrics: engagement, focus, etc. (license-dependent) */
  met?: PerformanceMetrics
  /** Band power per channel/label */
  pow?: Record<string, number>
  /** Mental command vector if licensed */
  com?: Record<string, number>
  /** Raw EEG: present only with proper license */
  eeg?: number[]
  contactQuality?: ContactQuality
  /** Device info / qua stream when available */
  qua?: Record<string, unknown>
}

export interface ProcessedEEG {
  focusLevel: number
  relaxation: number
  stressExcitement: number
  engagement: number
  cognitiveLoad: number
  /** Heuristic: alignment of focus, relaxation, and stability (not clinical coherence) */
  coherence_score: number
  bandPowerSummary?: { delta?: number; theta?: number; alpha?: number; beta?: number; gamma?: number }
  signal_lock_score: number
  clarity_score: number
  stability_score: number
  noise_score: number
  phase_label: PhaseLabel
  hasLiveData: boolean
  lastError?: string
}
