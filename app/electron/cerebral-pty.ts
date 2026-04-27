import { ipcMain } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { platform } from 'node:os'
import { randomUUID } from 'node:crypto'
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'

const sessions = new Map<string, IPty>()

function resolveShell(): { file: string; args: string[]; label: string } {
  if (platform() === 'win32') {
    return {
      file: join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      args: ['-NoLogo'],
      label: 'powershell'
    }
  }
  return {
    file: process.env.SHELL || '/bin/bash',
    args: ['-l'],
    label: 'bash'
  }
}

export type CerebralPtyBroadcast = (channel: string, payload: unknown) => void

/**
 * Full interactive shell (Windows: PowerShell via ConPTY). Pairs with xterm in the renderer.
 */
export function registerCerebralPtyIpc(getDefaultCwd: () => string, broadcast: CerebralPtyBroadcast): void {
  const safeCwd = (requested?: string): string => {
    const d = (requested && existsSync(requested) && statSync(requested).isDirectory() && requested) || getDefaultCwd()
    if (d && existsSync(d) && statSync(d).isDirectory()) {
      return d
    }
    return getDefaultCwd()
  }

  ipcMain.handle('cerebral:pty:spawn', (_e, a: { cwd?: string; cols: number; rows: number }) => {
    try {
      const id = randomUUID()
      const cwd = safeCwd(a?.cwd)
      const { file, args, label } = resolveShell()
      const isWin = platform() === 'win32'
      const t = pty.spawn(file, args, {
        name: 'xterm-256color',
        cols: Math.max(2, a.cols | 0),
        rows: Math.max(1, a.rows | 0),
        cwd,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } as { [k: string]: string },
        useConpty: isWin
      } as Parameters<typeof pty.spawn>[2])
      sessions.set(id, t)
      t.onData((data) => {
        broadcast('cerebral:pty:data', { id, data })
      })
      t.onExit((ev) => {
        sessions.delete(id)
        broadcast('cerebral:pty:exit', { id, code: ev.exitCode, signal: ev.signal ?? null })
      })
      return { ok: true as const, id, cwd, shell: label }
    } catch (e) {
      const err = e as Error
      return { ok: false as const, error: err.message || String(e) }
    }
  })

  ipcMain.handle('cerebral:pty:write', (_e, a: { id: string; data: string }) => {
    const t = sessions.get(a.id)
    if (!t) {
      return { ok: false as const, error: 'No such PTY' }
    }
    try {
      t.write(a.data)
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: (e as Error).message }
    }
  })

  ipcMain.handle('cerebral:pty:resize', (_e, a: { id: string; cols: number; rows: number }) => {
    const t = sessions.get(a.id)
    if (!t) {
      return { ok: false as const, error: 'No such PTY' }
    }
    try {
      t.resize(Math.max(2, a.cols | 0), Math.max(1, a.rows | 0))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: (e as Error).message }
    }
  })

  ipcMain.handle('cerebral:pty:clear', (_e, a: { id: string }) => {
    const t = sessions.get(a.id)
    if (!t) {
      return { ok: false as const, error: 'No such PTY' }
    }
    try {
      t.clear()
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: (e as Error).message }
    }
  })

  ipcMain.handle('cerebral:pty:kill', (_e, a: { id: string }) => {
    const t = sessions.get(a.id)
    if (!t) {
      return { ok: false as const, error: 'No such PTY' }
    }
    try {
      t.kill()
      sessions.delete(a.id)
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: (e as Error).message }
    }
  })
}
