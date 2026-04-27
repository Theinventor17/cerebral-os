import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useResonantAgents, CMDS } from '@/providers/ResonantAgentsProvider'
import { useNeuralThoughtOptional } from '@/providers/NeuralThoughtProvider'
import { useCerebralLayout } from '../context/CerebralTabContext'
import { useIdeLayoutRuntime } from '../layout/IdeLayoutRuntimeContext'
import { CerebralPtyTerminal } from './CerebralPtyTerminal'
import type { ThoughtCommandName } from '@/types'

const cmdL: Record<ThoughtCommandName, string> = {
  focus_agent: 'Focus',
  send_message: 'Message',
  ask_question: 'Question',
  request_output: 'Output',
  switch_agent: 'Switch',
  confirm_intent: 'Confirm',
  reject_intent: 'Reject',
  end_link: 'End link'
}

export function BottomPanel(): ReactNode {
  const { bottomTab, setBottomTab, workspaceRoot, persistNow } = useCerebralLayout()
  const { sessionId, activeAgent } = useResonantAgents()
  const { vertGroupRef, bottomPanelRef } = useIdeLayoutRuntime()
  const [termClearTick, setTermClearTick] = useState(0)
  const [addUserSessionTick, setAddUserSessionTick] = useState(0)
  const bumpAddUser = useCallback(() => {
    setAddUserSessionTick((n) => n + 1)
  }, [])

  return (
    <div className="cos-bottom" role="complementary" aria-label="Panel">
      <div className="cos-bhead">
        <div className="cos-btabs">
          {(['terminal', 'thought', 'plogs', 'approvals', 'history'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={bottomTab === k ? 'cos-bon' : undefined}
              onClick={() => setBottomTab(k)}
            >
              {k === 'terminal'
                ? 'Terminal'
                : k === 'thought'
                  ? 'Thought stream'
                  : k === 'plogs'
                    ? 'Provider logs'
                    : k === 'approvals'
                      ? 'Tool approvals'
                      : 'Execution history'}
            </button>
          ))}
        </div>
        <div className="cos-bactions">
          <button
            type="button"
            title="New user terminal"
            onClick={() => {
              if (bottomTab === 'terminal') {
                bumpAddUser()
              }
            }}
          >
            +
          </button>
          <button type="button" title="Split (placeholder)">
            ⧉
          </button>
          <button
            type="button"
            title="Clear terminal"
            onClick={() => {
              if (bottomTab === 'terminal') {
                setTermClearTick((n) => n + 1)
              }
            }}
          >
            ⌫
          </button>
          <button
            type="button"
            title="Maximize bottom"
            onClick={() => {
              vertGroupRef.current?.setLayout({ main: 25, bottom: 75 })
            }}
          >
            ▭
          </button>
          <button
            type="button"
            title="Close / collapse bottom"
            onClick={() => {
              bottomPanelRef.current?.isCollapsed() ? bottomPanelRef.current?.expand() : bottomPanelRef.current?.collapse()
            }}
          >
            ×
          </button>
        </div>
      </div>
      <div className={bottomTab === 'terminal' ? 'cos-bbody cos-bbody-term' : 'cos-bbody'} style={{ position: 'relative' }}>
        {bottomTab === 'terminal' && (
          <CerebralPtyTerminal
            key={addUserSessionTick}
            workspaceRoot={workspaceRoot}
            clearTrigger={termClearTick}
          />
        )}
        {bottomTab === 'thought' && <ThoughtPane />}
        {bottomTab === 'plogs' && <ProviderLogPane />}
        {bottomTab === 'approvals' && <ToolApprovalPane sessionId={sessionId} onDecided={() => persistNow()} activeAgentId={activeAgent?.id} />}
        {bottomTab === 'history' && <HistoryPane />}
      </div>
    </div>
  )
}

function ThoughtPane(): ReactNode {
  const { sessionMode, headset, insightLive, thoughtStatuses, signalLock, cortex, eegLine } = useResonantAgents()
  const neuro = useNeuralThoughtOptional()
  const st = signalLock == null ? '—' : `${Math.min(100, Math.round(signalLock <= 1 ? signalLock * 100 : signalLock))}%`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div className="cos-mono" style={{ marginBottom: 0, fontSize: 11, fontFamily: 'var(--font, sans-serif)' }}>
        Mode: {sessionMode === 'thought' ? 'Thought' : sessionMode === 'hybrid' ? 'Hybrid' : 'Manual'} | Headset: {headset} | Insight: {insightLive ? 'live' : 'off'} | Lock: {st} | Cortex: {cortex.ok ? 'ok' : 'off'}
      </div>
      {neuro && (sessionMode === 'thought' || sessionMode === 'hybrid') && (
        <div className="cos-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Mental: {neuro.latestToken?.mentalCommand ?? '—'} @ {neuro.mentalConfidence != null ? `${(neuro.mentalConfidence * 100).toFixed(0)}%` : '—'} | Meaning: {neuro.latestMeaning} | candidate #{neuro.candidates.length ? neuro.selectedIndex + 1 : 0} / {neuro.candidates.length}
        </div>
      )}
      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>No fake EEG. COM stream and metrics only from Cortex.</p>
      <p className="cos-mono" style={{ fontSize: 10, margin: 0 }}>
        {eegLine}
      </p>
      {CMDS.map((c) => {
        const t = thoughtStatuses[c]
        const label = !insightLive ? 'no signal' : t === 'idle' ? 'idle' : t
        return (
          <p key={c} style={{ margin: 2, fontSize: 10 }}>
            {cmdL[c]} — {String(label)}
          </p>
        )
      })}
    </div>
  )
}

function ProviderLogPane(): ReactNode {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    void (async () => {
      setRows((await window.cerebral.providerLog.list(100)) as Array<Record<string, unknown>>)
    })()
  }, [])
  return (
    <div>
      {rows.length === 0 && 'No provider calls yet.'}
      {rows.map((r) => (
        <p key={String(r.id)} style={{ margin: '3px 0' }}>
          {String(r.created_at)} {Number(r.success) === 1 ? 'OK' : 'ERR'} m={String(r.model_name ?? '')} {r.error_message ? String(r.error_message).slice(0, 120) : ''}
        </p>
      ))}
    </div>
  )
}

function ToolApprovalPane({
  sessionId,
  onDecided,
  activeAgentId
}: {
  sessionId: string | null
  onDecided: () => void
  activeAgentId?: string
}): ReactNode {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const { openShellGate } = useResonantAgents()

  const load = useCallback(() => {
    void (async () => {
      setRows((await window.cerebral.toolRequest.list('pending')) as Array<Record<string, unknown>>)
    })()
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 6px 0' }}>
        Proposed tool runs appear here. Approve to execute in the default workspace. Agent may include a shell step — always review.
      </p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button type="button" className="cos-chip" onClick={load}>
          Refresh
        </button>
        <button
          type="button"
          className="cos-chip"
          onClick={async () => {
            if (!sessionId || !activeAgentId) {
              return
            }
            await window.cerebral.toolRequest.submit({
              type: 'tool_request',
              tool: 'shell',
              command: 'echo cerebral-approval-ping',
              reason: 'Developer test: verify approval pipeline',
              riskLevel: 'low',
              sessionId,
              agentId: activeAgentId
            })
            load()
            onDecided()
          }}
        >
          + Test shell request
        </button>
        <button type="button" className="cos-chip" onClick={openShellGate}>
          Test permission gate
        </button>
      </div>
      {rows.length === 0 && <p className="cos-mono">No pending approvals.</p>}
      {rows.map((r) => (
        <div key={String(r.id)} className="cos-approval-card">
          <div>
            <strong>{String(r.tool)}</strong> — {String(r.risk_level)} — {String(r.status)}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', marginTop: 4 }}>{String(r.command_text)}</div>
          {r.reason != null && String(r.reason) !== '' ? (
            <div style={{ fontSize: 10, color: '#6f8097', marginTop: 4 }}>Reason: {String(r.reason)}</div>
          ) : null}
          {String(r.status) === 'pending' && (
            <div className="cos-approval-actions">
              <button
                type="button"
                className="cos-ok"
                onClick={async () => {
                  await window.cerebral.toolRequest.decide({ id: String(r.id), approved: true })
                  load()
                }}
              >
                Approve
              </button>
              <button
                type="button"
                className="cos-bad"
                onClick={async () => {
                  await window.cerebral.toolRequest.decide({ id: String(r.id), approved: false })
                  load()
                }}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function HistoryPane(): ReactNode {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    void (async () => {
      setRows((await window.cerebral.terminal.history(80)) as Array<Record<string, unknown>>)
    })()
  }, [])
  return (
    <div>
      {rows.length === 0 && 'No commands executed yet.'}
      {rows.map((r) => (
        <div key={String(r.id)} style={{ borderBottom: '1px solid #142236', padding: '4px 0' }}>
          <div className="cos-mono" style={{ fontSize: 10 }}>
            {String(r.started_at)} {String(r.source)} {String(r.status)} exit {String(r.exit_code ?? '—')}
          </div>
          <div style={{ fontSize: 10, color: '#6f8097' }}>{String(r.command_line)}</div>
          <div style={{ fontSize: 9, color: '#5c6a7d' }}>cwd: {String(r.cwd)}</div>
          {(r.stdout && String(r.stdout)) || (r.stderr && String(r.stderr)) ? (
            <div style={{ fontSize: 9, marginTop: 2, maxHeight: 40, overflow: 'hidden' }}>
              {String(r.stdout).slice(0, 200)}
              {String(r.stderr).slice(0, 200)}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
