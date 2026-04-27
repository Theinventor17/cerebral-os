import type { ReactNode } from 'react'
import { useNeuralThoughtOptional } from '@/providers/NeuralThoughtProvider'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'
import type { SentenceCandidate } from './NeuralAlphabetTypes'
import { workflowToPredictiveMode } from './NeuralAlphabetTypes'
import { shouldClarify } from './PredictiveSentenceBuilder'

const WF_KEY = 'cerebral.composer.workflow.v1'

function readWf() {
  try {
    const v = localStorage.getItem(WF_KEY)
    if (v === 'vibe' || v === 'imagine' || v === 'execute') {
      return v
    }
  } catch {
    // ignore
  }
  return 'vibe' as const
}

export function NeuralAlphabetPanel(): ReactNode {
  const { sessionMode, insightLive } = useResonantAgents()
  const nu = useNeuralThoughtOptional()
  const show = (sessionMode === 'thought' || sessionMode === 'hybrid') && insightLive
  if (!show || !nu) {
    return null
  }
  const mode = workflowToPredictiveMode(readWf())
  const clarify = nu.clarify || shouldClarify(nu.candidates)
  return (
    <div className="cos-neural-panel" style={{ fontSize: 11, borderTop: '1px solid #1b2b42', padding: '8px 0' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Neural alphabet · {mode}</div>
      {nu.noLive ? (
        <p style={{ color: 'var(--danger, #c44)', margin: 0 }}>No live signal</p>
      ) : (
        <>
          <p style={{ margin: '0 0 4px 0' }}>
            <strong>Command:</strong> {nu.latestToken?.mentalCommand ?? '—'} · <strong>conf</strong>{' '}
            {nu.mentalConfidence != null ? `${(nu.mentalConfidence * 100).toFixed(0)}%` : '—'}
          </p>
          <p style={{ margin: '0 0 4px 0' }}>
            <strong>Meaning:</strong> {nu.latestMeaning}
          </p>
          <p style={{ margin: '0 0 4px 0' }}>
            <strong>Current:</strong> {nu.currentSentenceText ?? '—'}
          </p>
          {clarify && nu.candidates.length > 1 && (
            <p style={{ margin: '4px 0', color: '#8fa0b8' }}>Did you mean: pick 1–{Math.min(5, nu.candidates.length)} or click below</p>
          )}
          <ol style={{ margin: '6px 0 0 18px', padding: 0, lineHeight: 1.45 }}>
            {nu.candidates.map((c: SentenceCandidate, i: number) => (
              <li
                key={c.id}
                style={{
                  fontWeight: i === nu.selectedIndex ? 700 as const : 400,
                  color: i === nu.selectedIndex ? 'var(--text, #e6ecf6)' : '#8fa0b8',
                  cursor: 'pointer',
                  textDecoration: i === nu.selectedIndex ? 'underline' : undefined
                }}
                onClick={() => nu.selectCandidate(i)}
              >
                {i + 1}. {c.text} <span style={{ fontSize: 9, opacity: 0.75 }}>({(c.confidence * 100).toFixed(0)}%)</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
