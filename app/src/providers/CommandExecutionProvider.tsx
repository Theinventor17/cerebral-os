import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CommandConfirmationModal } from '@/components/ide/CommandConfirmationModal'
import { CommandRouter } from '@/cerebral/commands/CommandRouter'
import { CommandEncyclopediaService } from '@/cerebral/commands/CommandEncyclopediaService'
import type { CommandEncyclopediaEntry } from '@/cerebral/commands/CommandEncyclopediaTypes'
import { useResonantAgents } from './ResonantAgentsProvider'
import type { ComposerWorkflowMode, InputSource } from '@/types'
import type { CerebralCommandRunPayload } from '../../electron/preload'

type Pending = {
  entry: CommandEncyclopediaEntry
  sentence: string
  source: 'manual' | 'thought' | 'hybrid'
}

type Ctx = {
  dispatchOutgoing: (
    text: string,
    inputSource: InputSource,
    opts?: { workflow?: ComposerWorkflowMode }
  ) => Promise<void>
}

const CommandExecCtx = createContext<Ctx | null>(null)

export function CommandExecutionProvider({ children }: { children: ReactNode }): ReactNode {
  const { sendMessage, sessionId, sessionMode } = useResonantAgents()
  const [pending, setPending] = useState<Pending | null>(null)

  const runChat = useCallback(
    async (text: string, inputSource: InputSource, opts?: { workflow?: ComposerWorkflowMode }) => {
      await sendMessage(text, inputSource, opts)
    },
    [sendMessage]
  )

  const dispatchOutgoing = useCallback(
    async (text: string, inputSource: InputSource, opts?: { workflow?: ComposerWorkflowMode }) => {
      const t = text.trim()
      if (!t) {
        return
      }
      await CommandEncyclopediaService.ensureSeeded()
      const entries = await CommandEncyclopediaService.list()
      const hit = CommandRouter.match(entries, t)
      if (!hit) {
        await runChat(t, inputSource, opts)
        return
      }
      let source: 'manual' | 'thought' | 'hybrid' = 'manual'
      if (inputSource === 'thought') {
        source = 'thought'
      } else if (sessionMode === 'hybrid') {
        source = 'hybrid'
      }
      setPending({ entry: hit.entry, sentence: t, source })
    },
    [runChat, sessionMode]
  )

  const close = useCallback(() => {
    setPending(null)
  }, [])

  const onApprove = useCallback(
    async (typedConfirm: string | undefined) => {
      if (!pending) {
        return
      }
      const cmd = (
        window as unknown as { cerebral?: { command?: { run: (a: CerebralCommandRunPayload) => Promise<unknown> } } }
      ).cerebral?.command
      if (!cmd?.run) {
        const backToChat: InputSource = pending.source === 'thought' ? 'thought' : 'manual'
        void runChat(pending.sentence, backToChat)
        close()
        return
      }
      const { entry, sentence, source } = pending
      close()
      await cmd.run({
        entryId: entry.id,
        sentence,
        source,
        approved: true,
        typedConfirm,
        sessionId: sessionId ?? null
      })
    },
    [close, pending, runChat, sessionId]
  )

  const onReject = useCallback(async () => {
    if (!pending) {
      return
    }
    const cmd = (
      window as unknown as { cerebral?: { command?: { run: (a: CerebralCommandRunPayload) => Promise<unknown> } } }
    ).cerebral?.command
    if (cmd?.run) {
      const { entry, sentence, source } = pending
      setPending(null)
      await cmd.run({
        entryId: entry.id,
        sentence,
        source,
        approved: false,
        sessionId: sessionId ?? null
      })
    } else {
      setPending(null)
    }
  }, [pending, sessionId])

  const value = useMemo<Ctx>(
    () => ({
      dispatchOutgoing
    }),
    [dispatchOutgoing]
  )

  return (
    <CommandExecCtx.Provider value={value}>
      {children}
      {pending ? (
        <CommandConfirmationModal
          open
          sentence={pending.sentence}
          source={pending.source}
          entry={pending.entry}
          onApprove={(typed) => void onApprove(typed)}
          onReject={() => void onReject()}
        />
      ) : null}
    </CommandExecCtx.Provider>
  )
}

export function useCommandExecution(): Ctx {
  const c = useContext(CommandExecCtx)
  if (!c) {
    throw new Error('useCommandExecution requires CommandExecutionProvider')
  }
  return c
}

export function useCommandExecutionOptional(): Ctx | null {
  return useContext(CommandExecCtx)
}
