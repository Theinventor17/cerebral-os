import type { ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CMDS, useResonantAgents } from '../../providers/ResonantAgentsProvider'
import type { ThoughtCommandName } from '../../types'

type BTab = 'terminal' | 'thought' | 'plogs' | 'approvals'

const cmdLabels: Record<ThoughtCommandName, string> = {
  focus_agent: 'Focus Agent',
  send_message: 'Send Message',
  ask_question: 'Ask Question',
  request_output: 'Request Output',
  switch_agent: 'Switch Agent',
  confirm_intent: 'Confirm Intent',
  reject_intent: 'Reject Intent',
  end_link: 'End link'
}

export function IDEBottomPanel(): ReactNode {
  const [tab, setTab] = useState<BTab>('thought')
  const navigate = useNavigate()
  const {
    sendError,
    sessionMode,
    headset,
    headsetLive,
    thoughtStatuses,
    signalLock,
    ollamaLabel,
    lmStudioUp,
    openRouterEnabled,
    cortex
  } = useResonantAgents()

  return (
    <div className="cide-bottom" role="complementary" aria-label="Output">
      <div className="cide-b-tabs">
        <button type="button" className={tab === 'terminal' ? 'cide-b-on' : ''} onClick={() => setTab('terminal')}>
          Terminal
        </button>
        <button type="button" className={tab === 'thought' ? 'cide-b-on' : ''} onClick={() => setTab('thought')}>
          Thought stream
        </button>
        <button type="button" className={tab === 'plogs' ? 'cide-b-on' : ''} onClick={() => setTab('plogs')}>
          Provider logs
        </button>
        <button type="button" className={tab === 'approvals' ? 'cide-b-on' : ''} onClick={() => setTab('approvals')}>
          Tool approvals
        </button>
      </div>
      <div className="cide-b-body" role="tabpanel">
        {tab === 'terminal' && (
          <div>
            {sendError && (
              <pre className="cide-b-term" style={{ color: '#ff8b8b' }}>
                {sendError}
              </pre>
            )}
            {!sendError && <p className="cide-b-empty">Build / provider errors appear here. Type in chat without a headset in Manual or Hybrid mode.</p>}
            <p className="cide-b-empty" style={{ marginTop: 8 }}>
              Check Provider logs for Ollama, LM Studio, and OpenRouter status.
            </p>
          </div>
        )}
        {tab === 'thought' && (
          <div>
            <div className="cide-b-grid" style={{ marginBottom: 10 }}>
              <div>
                <span>Mode</span>
                {sessionMode === 'thought' ? 'Thought' : sessionMode === 'hybrid' ? 'Hybrid' : 'Manual'}
              </div>
              <div>
                <span>Headset</span>
                {headset}
              </div>
              <div>
                <span>Headset link</span>
                {headsetLive ? 'OK' : '—'}
              </div>
              <div>
                <span>Signal lock</span>
                {signalLock == null
                  ? '—'
                  : `${Math.min(100, Math.round(signalLock <= 1 ? signalLock * 100 : signalLock))}%`}
              </div>
            </div>
            <p className="cide-b-empty" style={{ marginBottom: 6 }}>
              Detected commands
            </p>
            {CMDS.map((c) => {
              const st = thoughtStatuses[c]
              const stLabel = !headsetLive ? 'No signal' : st === 'idle' ? 'Idle' : st.charAt(0).toUpperCase() + st.slice(1)
              return (
                <div key={c} className={`cide-b-cmd ${st !== 'idle' && headsetLive ? 'cide-ok' : ''}`.trim()}>
                  {cmdLabels[c]} — {stLabel}
                </div>
              )
            })}
          </div>
        )}
        {tab === 'plogs' && (
          <div>
            <div className="cide-b-grid">
              <div>
                <span>Ollama</span>
                {ollamaLabel}
              </div>
              <div>
                <span>LM Studio</span>
                {lmStudioUp == null ? 'n/a' : lmStudioUp ? 'OK :1234' : 'down'}
              </div>
              <div>
                <span>OpenRouter</span>
                {openRouterEnabled ? 'Enabled' : 'Off'}
              </div>
              <div>
                <span>Cortex</span>
                {cortex.ok ? 'OK' : 'Unavailable'}
              </div>
            </div>
            <p className="cide-b-empty">Configure OpenRouter, OpenAI, Anthropic, Gemini, Ollama, LM Studio, llama.cpp, custom, GGUF in Providers.</p>
          </div>
        )}
        {tab === 'approvals' && (
          <div>
            <p className="cide-b-empty" style={{ marginBottom: 8 }}>
              Review shell and high-risk tool prompts. Route to full list:
            </p>
            <button type="button" className="cide-btn" onClick={() => void navigate('/app/approvals')}>
              Open tool approvals
            </button>
            <p className="cide-b-empty" style={{ marginTop: 8 }}>Test permission gate from Active Session or Settings as needed.</p>
          </div>
        )}
      </div>
    </div>
  )
}
