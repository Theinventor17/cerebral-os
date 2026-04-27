/**
 * Streams a single shell command via main-process `cerebral:workspace:runCommandStream`.
 * Guarantees IPC listener removal on success, failure, or `invoke` rejection.
 */
export type CommandStreamHandlers = {
  onChunk?: (stream: 'stdout' | 'stderr', data: string) => void
}

type StreamApi = {
  runCommandStream: (a: { runId: string; command: string; workspaceId?: string }) => Promise<
    { ok: true } | { ok: false; error: string }
  >
  onCommandChunk: (cb: (p: { runId: string; stream: 'stdout' | 'stderr'; data: string }) => void) => () => void
  onCommandExit: (cb: (p: { runId: string; code: number; signal: string | null; error?: string }) => void) => () => void
}

export async function runStreamedWorkspaceCommand(
  runId: string,
  command: string,
  workspaceId: string,
  handlers: CommandStreamHandlers
): Promise<{ code: number; out: string }> {
  const c = window.cerebral?.workspace as StreamApi | undefined
  if (!c?.runCommandStream || !c.onCommandChunk || !c.onCommandExit) {
    throw new Error('Workspace stream API unavailable')
  }

  return new Promise((resolve, reject) => {
    let out = ''
    let settled = false

    const off1 = c.onCommandChunk!((p) => {
      if (p.runId !== runId) {
        return
      }
      out += p.data
      handlers.onChunk?.(p.stream, p.data)
    })

    const off2 = c.onCommandExit!((p) => {
      if (p.runId !== runId) {
        return
      }
      finish(() => {
        const code = p.error ? 1 : p.code
        const tail = p.error ? `\n${p.error}` : ''
        resolve({ code: code ?? 1, out: out + tail })
      })
    })

    function finish(action: () => void) {
      if (settled) {
        return
      }
      settled = true
      try {
        off1()
      } catch {
        // ignore
      }
      try {
        off2()
      } catch {
        // ignore
      }
      action()
    }

    void c
      .runCommandStream({ runId, command, workspaceId })
      .then((st) => {
        if (!st.ok) {
          finish(() => {
            reject(new Error(st.error ?? 'Failed to start command'))
          })
        }
      })
      .catch((err) => {
        finish(() => {
          reject(err instanceof Error ? err : new Error(String(err)))
        })
      })
  })
}
