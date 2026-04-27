import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EmotivInsightAdapter } from '@/cerebral/headsets'
import { buildTokenFromMentalAction, mapCortexMentalToToken } from '@/cerebral/neural-alphabet/EmotivInsightAlphabetAdapter'
import { NeuralAlphabetService } from '@/cerebral/neural-alphabet/NeuralAlphabetService'
import { buildPredictiveCandidates, shouldClarify } from '@/cerebral/neural-alphabet/PredictiveSentenceBuilder'
import { createInitialThoughtState, reduceThoughtSelection } from '@/cerebral/neural-alphabet/ThoughtSelectionController'
import type { NeuralAlphabetToken, SentenceCandidate } from '@/cerebral/neural-alphabet/NeuralAlphabetTypes'
import { workflowToPredictiveMode } from '@/cerebral/neural-alphabet/NeuralAlphabetTypes'
import { emotivCortex } from '@/services/EmotivCortexService'
import type { ComposerWorkflowMode } from '@/types'
import { useResonantAgents } from './ResonantAgentsProvider'
import { useCommandExecutionOptional } from './CommandExecutionProvider'

const WF = 'cerebral.composer.workflow.v1'

function readWorkflow(): ComposerWorkflowMode {
  try {
    const v = localStorage.getItem(WF)
    if (v === 'vibe' || v === 'imagine' || v === 'execute') {
      return v
    }
  } catch {
    // ignore
  }
  return 'vibe'
}

type NeCtx = {
  latestToken: NeuralAlphabetToken | null
  latestMeaning: string
  mentalConfidence: number | null
  candidates: SentenceCandidate[]
  selectedIndex: number
  clarify: boolean
  noLive: boolean
  setSelectedIndex: (i: number) => void
  selectCandidate: (i: number) => void
  confirmNumber: (n: number) => void
  currentSentenceText: string | null
  refreshFromWorkflow: () => void
}

const NeuralCtx = createContext<NeCtx | null>(null)

export function NeuralThoughtProvider({ children }: { children: ReactNode }): ReactNode {
  const { sessionId, sessionMode, insightLive, sendMessage } = useResonantAgents()
  const commandExec = useCommandExecutionOptional()
  const [latestToken, setLatestToken] = useState<NeuralAlphabetToken | null>(null)
  const [candidates, setCandidates] = useState<SentenceCandidate[]>([])
  const [sel, setSel] = useState(0)
  const [clar, setClar] = useState(false)
  const [meaning, setMeaning] = useState('—')
  const [mconf, setMconf] = useState<number | null>(null)
  const thState = useRef(createInitialThoughtState())
  const lastTokenAt = useRef(0)
  const candidatesRef = useRef<SentenceCandidate[]>([])
  const selRef = useRef(0)
  const wf = useRef<ComposerWorkflowMode>(readWorkflow())

  useEffect(() => {
    candidatesRef.current = candidates
  }, [candidates])
  useEffect(() => {
    selRef.current = sel
  }, [sel])

  const useNeural = (sessionMode === 'thought' && insightLive) || (sessionMode === 'hybrid' && insightLive)

  const refreshFromWorkflow = useCallback(() => {
    wf.current = readWorkflow()
  }, [])

  useEffect(() => {
    const o = () => {
      refreshFromWorkflow()
    }
    window.addEventListener('cerebral:workflow', o)
    return () => window.removeEventListener('cerebral:workflow', o)
  }, [refreshFromWorkflow])

  useEffect(() => {
    if (!useNeural) {
      return
    }
    return emotivCortex.onStream((_, raw) => {
      let token: NeuralAlphabetToken | null = null
      const d = raw as { com?: unknown }
      if (d.com != null) {
        token = mapCortexMentalToToken(d.com, 0.75, new Date().toISOString())
      }
      if (!token) {
        const frame = EmotivInsightAdapter.normalizeFrame(raw)
        if (frame?.mentalCommand?.action) {
          token = buildTokenFromMentalAction(
            frame.mentalCommand.action,
            frame.mentalCommand.power ?? 0.55,
            new Date().toISOString()
          )
        }
      }
      if (!token || token.confidence < 0.32) {
        return
      }
      const t = token.mentalCommand
      if (t === 'neutral' && token.confidence < 0.5) {
        return
      }
      if (Date.now() - lastTokenAt.current < 320) {
        return
      }
      lastTokenAt.current = Date.now()
      setLatestToken(token)
      setMconf(token.confidence)
      setMeaning(token.mappedMeanings[0] ?? t)
      void NeuralAlphabetService.logToken(sessionId, token)

      const cur = candidatesRef.current
      const { state: next, effect } = reduceThoughtSelection(thState.current, token)
      thState.current = next

      if (effect === 'cancel') {
        setCandidates([])
        setSel(0)
        setClar(false)
        thState.current = createInitialThoughtState()
        void NeuralAlphabetService.logSelectionEvent(sessionId, 'cancel', { command: t })
        return
      }

      if (effect === 'confirm' && cur.length > 0) {
        const c = cur[selRef.current]
        if (c) {
          void NeuralAlphabetService.logSelectionEvent(sessionId, 'confirm', { id: c.id, text: c.text })
          if (commandExec) {
            void commandExec.dispatchOutgoing(c.text, 'thought', { workflow: wf.current })
          } else {
            void sendMessage(c.text, 'thought', { workflow: wf.current })
          }
        }
        return
      }

      if (cur.length > 0) {
        if (t === 'left' || t === 'rotateLeft') {
          setSel((s) => {
            const n = Math.max(0, s - 1)
            return n
          })
          return
        }
        if (t === 'right' || t === 'rotateRight') {
          setSel((s) => Math.max(0, Math.min(cur.length - 1, s + 1)))
          return
        }
        if (t === 'pull' || t === 'drop') {
          setCandidates([])
          setSel(0)
          void NeuralAlphabetService.logSelectionEvent(sessionId, 'cancel', { command: t })
          return
        }
      }

      const mode = workflowToPredictiveMode(wf.current)
      const built = buildPredictiveCandidates(mode, token, 5)
      setCandidates(built)
      setSel(0)
      setClar(shouldClarify(built))
      thState.current = { ...thState.current, candidates: built, selectedIndex: 0 }
      if (built[0]) {
        void NeuralAlphabetService.logCandidateBatch(sessionId, `b-${Date.now()}`, built[0])
      }
    })
  }, [useNeural, sessionId, sendMessage, commandExec])

  const setSelectedIndex = useCallback((i: number) => {
    if (candidates.length === 0) {
      return
    }
    setSel(Math.max(0, Math.min(candidates.length - 1, i)))
  }, [candidates.length])

  const currentSentence = candidates[sel] ?? null

  const value = useMemo<NeCtx>(
    () => ({
      latestToken,
      latestMeaning: meaning,
      mentalConfidence: mconf,
      candidates,
      selectedIndex: sel,
      clarify: clar,
      noLive: !insightLive,
      setSelectedIndex,
      selectCandidate: (i) => {
        setSelectedIndex(i)
        void NeuralAlphabetService.logSelectionEvent(sessionId, 'nav', { index: i })
      },
      confirmNumber: (n) => {
        const i = n - 1
        if (i >= 0 && i < candidates.length) {
          setSel(i)
          const c = candidates[i]
          if (c) {
            void NeuralAlphabetService.logSelectionEvent(sessionId, 'keyboard', { index: i, id: c.id })
            if (commandExec) {
              void commandExec.dispatchOutgoing(c.text, 'thought', { workflow: wf.current })
            } else {
              void sendMessage(c.text, 'thought', { workflow: wf.current })
            }
          }
        }
      },
      currentSentenceText: currentSentence?.text ?? null,
      refreshFromWorkflow
    }),
    [
      latestToken,
      meaning,
      mconf,
      candidates,
      sel,
      clar,
      insightLive,
      setSelectedIndex,
      sessionId,
      sendMessage,
      commandExec,
      currentSentence,
      refreshFromWorkflow
    ]
  )

  return <NeuralCtx.Provider value={value}>{children}</NeuralCtx.Provider>
}

export function useNeuralThought(): NeCtx {
  const c = useContext(NeuralCtx)
  if (!c) {
    throw new Error('useNeuralThought requires NeuralThoughtProvider')
  }
  return c
}

export function useNeuralThoughtOptional(): NeCtx | null {
  return useContext(NeuralCtx)
}
