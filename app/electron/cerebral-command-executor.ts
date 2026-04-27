import { ipcMain, shell } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { createConnection, type Socket } from 'node:net'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import type DatabaseConstructor from 'better-sqlite3'
import {
  raEncyclopediaList,
  raInsertCommandExecutionEvent,
  raInsertThoughtSelectionEvent,
  raEnsureSeed
} from './ra-db'
import { newCerebralId } from './cerebral-db'

const execFileAsync = promisify(execFile)

type SqliteDb = DatabaseConstructor.Database

type CommandAction =
  | { type: 'hotkey'; keys: string[] }
  | { type: 'keypress'; key: string; presses?: number }
  | { type: 'shell'; command: string }
  | { type: 'socket'; host: string; port: number; payload: string }
  | { type: 'internal'; handler: string }

type EntryRow = {
  id: string
  phrase: string
  aliases_json: string
  mode: string
  category: string
  intent: string
  action_json: string
  risk_level: string
  requires_confirmation: number
  enabled: number
}

function rowToAction(r: EntryRow): CommandAction {
  return JSON.parse(r.action_json) as CommandAction
}

function isShellBlocked(line: string): { blocked: true; reason: string } | { blocked: false } {
  const t = line.trim()
  if (t.length === 0) {
    return { blocked: true, reason: 'Empty command' }
  }
  if (t.length > 4000) {
    return { blocked: true, reason: 'Command line too long' }
  }
  const s = t.toLowerCase()
  if (s.includes('rm -rf /') || s.includes('rm -rf  /')) {
    return { blocked: true, reason: 'Potentially destructive path removal blocked' }
  }
  if (s.includes('format c:') || s.includes('format c ')) {
    return { blocked: true, reason: 'Disk format blocked' }
  }
  if (/\bmkfs\.|\bdd\s+if=/.test(t)) {
    return { blocked: true, reason: 'Low-level device write blocked' }
  }
  if (/>[ \t]*(\/dev\/(sd|hd|nvme|disk))/.test(t)) {
    return { blocked: true, reason: 'Direct block device write blocked' }
  }
  if (s.includes('diskpart')) {
    return { blocked: true, reason: 'diskpart blocked' }
  }
  return { blocked: false }
}

function findMatchInEntries(rows: EntryRow[], text: string): { entry: EntryRow; score: number; aliasesHit: string[] } | null {
  const t = text.trim().toLowerCase()
  if (!t) {
    return null
  }
  let best: { entry: EntryRow; score: number; aliasesHit: string[] } | null = null
  for (const e of rows) {
    if (e.enabled === 0) {
      continue
    }
    const aliases = JSON.parse(e.aliases_json) as string[]
    if (e.phrase.toLowerCase() === t) {
      return { entry: e, score: 1, aliasesHit: [e.phrase] }
    }
    const aliasHit = aliases.find((a) => a.toLowerCase() === t)
    if (aliasHit) {
      return { entry: e, score: 0.9, aliasesHit: [aliasHit] }
    }
    if (e.phrase.toLowerCase().includes(t) && t.length > 2) {
      if (!best || 0.5 > best.score) {
        best = { entry: e, score: 0.5, aliasesHit: [e.phrase] }
      }
    }
  }
  return best
}

const HOTKEY_SHELL_MAP: Record<string, () => Promise<string>> = {
  'win+e': async () => {
    await execFileAsync('explorer', [], { windowsHide: true })
    return 'Opened File Explorer (explorer.exe)'
  },
  'win+i': async () => {
    await execFileAsync('cmd', ['/d', '/c', 'start', 'ms-settings:'], { windowsHide: true })
    return 'Opened Settings'
  }
}

function normHotkeyKey(k: string): string {
  return k.trim()
}

function hotkeyId(keys: string[]): string {
  return keys.map((k) => normHotkeyKey(k).toLowerCase()).join('+')
}

function vkForKey(k0: string): number | null {
  const k = k0.toLowerCase()
  if (k === 'control' || k === 'ctrl') {
    return 0x11
  }
  if (k === 'shift') {
    return 0x10
  }
  if (k === 'alt') {
    return 0x12
  }
  if (k === 'win' || k === 'lwin' || k === 'rwin') {
    return 0x5b
  }
  if (k === 'tab') {
    return 0x09
  }
  if (k === 'enter' || k === 'return') {
    return 0x0d
  }
  if (k === 'esc' || k === 'escape') {
    return 0x1b
  }
  if (k === 'space') {
    return 0x20
  }
  if (k === 'backspace') {
    return 0x08
  }
  if (k === 'delete') {
    return 0x2e
  }
  if (k === 'up' || k === 'arrowup' || k === 'audiovolumeup') {
    return 0x26
  }
  if (k === 'down' || k === 'arrowdown' || k === 'audiovolumedown') {
    return 0x28
  }
  if (k === 'left' || k === 'arrowleft') {
    return 0x25
  }
  if (k === 'right' || k === 'arrowright') {
    return 0x27
  }
  if (k === 'home') {
    return 0x24
  }
  if (k === 'end') {
    return 0x23
  }
  if (k === 'pageup' || k === 'pgup') {
    return 0x21
  }
  if (k === 'pagedown' || k === 'pgdn') {
    return 0x22
  }
  if (k.length === 1) {
    const c = k
    if (c >= 'a' && c <= 'z') {
      return 0x41 + (c.charCodeAt(0) - 0x61)
    }
    if (c >= '0' && c <= '9') {
      return 0x30 + (c.charCodeAt(0) - 0x30)
    }
  }
  const fn = k.match(/^f(\d+)$/i)
  if (fn) {
    const n = Number(fn[1])
    if (n >= 1 && n <= 12) {
      return 0x70 + (n - 1)
    }
  }
  if (k === 'mediaplaypause' || k === 'playpause' || k === 'play pause') {
    return 0xb3
  }
  if (k === 'medianexttrack' || k === 'next track') {
    return 0xb0
  }
  if (k === 'mediaprevioustrack' || k === 'previous track') {
    return 0xb1
  }
  if (k === 'audiovolumemute' || k === 'mute') {
    return 0xad
  }
  if (k === '=' || k === 'plus' || k === 'equal' || k === 'equals') {
    return 0xbb
  }
  if (k === '-' || k === 'minus') {
    return 0xbd
  }
  return null
}

const KEYEVENTF_KEYUP = 0x2

function addTypeW(): string {
  return `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W { [DllImport("user32.dll")] public static extern void keybd_event(byte bVK, byte bScan, uint dwFlags, int dwExtraInfo); }' -Language CSharp;`
}

function buildKeybdPowershell(vksDown: number[], vksUp: number[]): string {
  const down = vksDown.map((vk) => `[W]::keybd_event([byte]${vk},0,0,0)`).join(';')
  const up = vksUp.map((vk) => `[W]::keybd_event([byte]${vk},0,${KEYEVENTF_KEYUP},0)`).join(';')
  return `${addTypeW()}${down};${up}`
}

function buildKeybdAlternating(vk: number, presses: number): string {
  const parts: string[] = [addTypeW()]
  for (let i = 0; i < presses; i += 1) {
    parts.push(
      `[W]::keybd_event([byte]${vk},0,0,0);[W]::keybd_event([byte]${vk},0,${KEYEVENTF_KEYUP},0)`
    )
  }
  return parts.join('')
}

/**
 * Windows only: best-effort global hotkey. Uses shell shortcuts for common combos, else keybd_event.
 */
async function runHotkey(keys: string[]): Promise<string> {
  if (process.platform !== 'win32') {
    return 'Hotkey execution is only supported on Windows in this build'
  }
  const id = hotkeyId(keys)
  if (HOTKEY_SHELL_MAP[id]) {
    return await HOTKEY_SHELL_MAP[id]!()
  }

  const keysNorm = keys.map((x) => normHotkeyKey(x).toLowerCase())
  const mods: number[] = []
  const other: string[] = []
  for (const k0 of keysNorm) {
    const m = k0 === 'lwin' || k0 === 'rwin' ? 'win' : k0 === 'control' ? 'ctrl' : k0
    if (m === 'win' || m === 'ctrl' || m === 'shift' || m === 'alt') {
      const vk = vkForKey(m)
      if (vk == null) {
        return `Unsupported modifier: ${k0}`
      }
      if (!mods.includes(vk)) {
        mods.push(vk)
      }
    } else {
      other.push(k0)
    }
  }
  const vks: number[] = []
  for (const m of [0x5b, 0x11, 0x10, 0x12]) {
    if (mods.includes(m)) {
      vks.push(m)
    }
  }
  for (const o of other) {
    const vk = vkForKey(o)
    if (vk == null) {
      return `Unsupported key: ${o}`
    }
    vks.push(vk)
  }
  if (vks.length === 0) {
    return 'No keys in hotkey'
  }
  const vksUp = [...vks].reverse()
  const ps = buildKeybdPowershell(vks, vksUp)
  return new Promise((resolve, reject) => {
    const c = execFile(
      'powershell',
      ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps],
      { windowsHide: true, timeout: 15_000 },
      (e, so, se) => {
        if (e) {
          reject(new Error((se || e.message).toString() || e.message))
        } else {
          resolve(so || `Hotkey keybd: ${id}`)
        }
      }
    )
    c.on('error', reject)
  })
}

async function runKeypress(k: string, presses = 1): Promise<string> {
  if (process.platform !== 'win32') {
    return 'Keypress execution is only supported on Windows in this build'
  }
  const n = Math.min(8, Math.max(1, presses))
  const vk = vkForKey(k)
  if (vk == null) {
    return `Unsupported key: ${k}`
  }
  const ps = buildKeybdAlternating(vk, n)
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps],
      { windowsHide: true, timeout: 10_000 },
      (e, so, se) => {
        if (e) {
          reject(new Error((se || e.message).toString() || e.message))
        } else {
          resolve(so || `keypress x${n}`)
        }
      }
    )
  })
}

function collectShell(command: string, cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32'
    const child = isWin
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
          cwd,
          windowsHide: true,
          env: { ...process.env, NODE_OPTIONS: undefined }
        })
      : spawn('/bin/sh', ['-c', command], { cwd, env: { ...process.env, NODE_OPTIONS: undefined } })
    let out = ''
    let err = ''
    child.stdout?.on('data', (c) => {
      out += c.toString()
    })
    child.stderr?.on('data', (c) => {
      err += c.toString()
    })
    child.on('error', (e) => reject(e))
    child.on('close', (code, signal) => {
      resolve({ code: code ?? (signal ? 1 : 0), stdout: out, stderr: err })
    })
  })
}

function runSocket(host: string, port: number, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const s: Socket = createConnection({ host, port, timeout: 5000 }, () => {
      s.write(payload, (e) => {
        if (e) {
          s.destroy()
          return reject(e)
        }
        s.end()
      })
    })
    s.once('error', (e) => {
      s.destroy()
      reject(e)
    })
    s.once('end', () => {
      resolve('socket sent')
    })
  })
}

export function registerCerebralCommandIpc(
  getDb: () => SqliteDb,
  _appLog: (m: string) => void
): void {
  const ensureDb = (): SqliteDb => {
    const d = getDb()
    raEnsureSeed(d)
    return d
  }

  const runPayload = (args: {
    entry: EntryRow
    action: CommandAction
    source: 'manual' | 'thought' | 'hybrid'
    sentence: string
    approved: boolean
    typedConfirm?: string
    sessionId: string | null
  }): Promise<{ ok: boolean; output?: string; error?: string; status: string }> => {
    const d = ensureDb()
    const row = args.entry
    const id = newCerebralId()
    const t0 = new Date().toISOString()
    const risk = String(row.risk_level) as 'low' | 'medium' | 'high'
    if (args.approved && risk === 'high' && (args.typedConfirm ?? '') !== 'CONFIRM') {
      const err = 'High-risk action requires typing CONFIRM exactly'
      raInsertCommandExecutionEvent(d, {
        id,
        command_entry_id: row.id,
        source: args.source,
        sentence: args.sentence,
        action_type: args.action.type,
        risk_level: risk,
        status: 'blocked',
        approved: 1,
        output: null,
        error: err,
        created_at: t0,
        executed_at: t0
      })
      if (args.sessionId) {
        raInsertThoughtSelectionEvent(d, {
          id: newCerebralId(),
          session_id: args.sessionId,
          event_type: 'command_result',
          payload_json: JSON.stringify({ entryId: row.id, ok: false, error: err }),
          created_at: t0
        })
      }
      return Promise.resolve({ ok: false, error: err, status: 'blocked' })
    }

    if (!args.approved) {
      raInsertCommandExecutionEvent(d, {
        id,
        command_entry_id: row.id,
        source: args.source,
        sentence: args.sentence,
        action_type: args.action.type,
        risk_level: risk,
        status: 'rejected',
        approved: 0,
        output: null,
        error: null,
        created_at: t0,
        executed_at: t0
      })
      if (args.sessionId) {
        raInsertThoughtSelectionEvent(d, {
          id: newCerebralId(),
          session_id: args.sessionId,
          event_type: 'command_dismiss',
          payload_json: JSON.stringify({ entryId: row.id, sentence: args.sentence }),
          created_at: t0
        })
      }
      return Promise.resolve({ ok: true, status: 'rejected' })
    }

    const runApprovedAction = async (): Promise<{ ok: boolean; output: string; error?: string }> => {
      const a = args.action
      const cwd = homedir()
      try {
        if (a.type === 'internal') {
          if (a.handler === 'cerebral.openUserData') {
            await shell.openPath(homedir())
            return { ok: true, output: 'shell.openPath user folder' }
          }
          if (a.handler === 'cerebral.focusComposer') {
            return { ok: true, output: 'internal: focus composer (no-op in main process)' }
          }
          return { ok: true, output: `internal: ${a.handler} (no-op)` }
        }
        if (a.type === 'shell') {
          const g = isShellBlocked(a.command)
          if (g.blocked) {
            return { ok: false, output: '', error: g.reason }
          }
          const { code, stdout, stderr } = await collectShell(a.command, cwd)
          const err = stderr && stderr.trim() ? stderr : undefined
          if (code !== 0) {
            return { ok: false, output: stdout, error: err || `exit ${code}` }
          }
          return { ok: true, output: (stdout + stderr).trim() || 'ok' }
        }
        if (a.type === 'socket') {
          const msg = await runSocket(a.host, a.port, a.payload)
          return { ok: true, output: msg }
        }
        if (a.type === 'keypress') {
          const p = a.presses ?? 1
          const out = await runKeypress(a.key, p)
          return { ok: true, output: out }
        }
        if (a.type === 'hotkey') {
          const out = await runHotkey(a.keys)
          return { ok: true, output: out }
        }
        return { ok: false, output: '', error: 'Unknown action' }
      } catch (e) {
        return { ok: false, output: '', error: (e as Error).message }
      }
    }

    return runApprovedAction()
      .then((r) => {
        const t1 = new Date().toISOString()
        raInsertCommandExecutionEvent(d, {
          id,
          command_entry_id: row.id,
          source: args.source,
          sentence: args.sentence,
          action_type: args.action.type,
          risk_level: risk,
          status: r.ok ? 'ok' : 'error',
          approved: 1,
          output: r.output ?? null,
          error: r.error ?? null,
          created_at: t0,
          executed_at: t1
        })
        if (args.sessionId) {
          raInsertThoughtSelectionEvent(d, {
            id: newCerebralId(),
            session_id: args.sessionId,
            event_type: 'command_result',
            payload_json: JSON.stringify({
              entryId: row.id,
              ok: r.ok,
              output: r.output,
              error: r.error
            }),
            created_at: t1
          })
        }
        return { ok: r.ok, output: r.output, error: r.error, status: r.ok ? 'ok' : 'error' }
      })
      .catch((e) => {
        const t1 = new Date().toISOString()
        const em = (e as Error).message
        raInsertCommandExecutionEvent(d, {
          id,
          command_entry_id: row.id,
          source: args.source,
          sentence: args.sentence,
          action_type: args.action.type,
          risk_level: risk,
          status: 'error',
          approved: 1,
          output: null,
          error: em,
          created_at: t0,
          executed_at: t1
        })
        if (args.sessionId) {
          raInsertThoughtSelectionEvent(d, {
            id: newCerebralId(),
            session_id: args.sessionId,
            event_type: 'command_result',
            payload_json: JSON.stringify({ entryId: row.id, ok: false, error: em }),
            created_at: t1
          })
        }
        return { ok: false, error: em, status: 'error' }
      })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toRow = (r: any): EntryRow | null => {
    if (!r || !r.id) {
      return null
    }
    return r as EntryRow
  }

  const getEntry = (id: string): { row: EntryRow; action: CommandAction } | null => {
    const d = ensureDb()
    const r = d.prepare('SELECT * FROM command_encyclopedia_entries WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    if (!r) {
      return null
    }
    const row = toRow(r)
    if (!row) {
      return null
    }
    if (row.enabled === 0) {
      return null
    }
    return { row, action: rowToAction(row) }
  }

  ipcMain.handle('command:previewMatch', (_e, a: { text: string } | string) => {
    const text = typeof a === 'string' ? a : a.text
    const d = ensureDb()
    const list = raEncyclopediaList(d) as unknown as EntryRow[]
    const m = findMatchInEntries(list, String(text))
    if (!m) {
      return { match: null as null }
    }
    const action = rowToAction(m.entry)
    const phrase = m.entry.phrase
    return {
      match: {
        id: m.entry.id,
        phrase,
        aliasesMatched: m.aliasesHit,
        score: m.score,
        mode: m.entry.mode,
        category: m.entry.category,
        actionPreview: action,
        riskLevel: m.entry.risk_level,
        requiresConfirmation: m.entry.requires_confirmation === 1
      }
    }
  })

  const commonRun = (payload: {
    entryId: string
    sentence: string
    source: 'manual' | 'thought' | 'hybrid'
    approved: boolean
    typedConfirm?: string
    sessionId?: string | null
  }) => {
    const e = getEntry(payload.entryId)
    if (!e) {
      return Promise.resolve({ ok: false, error: 'Command entry not found' })
    }
    return runPayload({
      entry: e.row,
      action: e.action,
      source: payload.source,
      sentence: payload.sentence,
      approved: payload.approved,
      typedConfirm: payload.typedConfirm,
      sessionId: payload.sessionId ?? null
    })
  }

  ipcMain.handle('command:run', (_e, p: unknown) => commonRun(p as never))

  type RunPayload = {
    entryId: string
    sentence: string
    source: 'manual' | 'thought' | 'hybrid'
    approved: boolean
    typedConfirm?: string
    sessionId?: string | null
  }
  const forActionType = (actionType: string) => (payload: RunPayload) => {
    const g = getEntry(payload.entryId)
    if (!g || g.action.type !== actionType) {
      return Promise.resolve({ ok: false as const, error: `action must be type ${actionType}` })
    }
    return commonRun(payload)
  }

  ipcMain.handle('command:executeHotkey', (_e, p) => forActionType('hotkey')(p as RunPayload))
  ipcMain.handle('command:executeKeypress', (_e, p) => forActionType('keypress')(p as RunPayload))
  ipcMain.handle('command:executeShell', (_e, p) => forActionType('shell')(p as RunPayload))
  ipcMain.handle('command:executeSocket', (_e, p) => forActionType('socket')(p as RunPayload))
  ipcMain.handle('command:executeInternal', (_e, p) => forActionType('internal')(p as RunPayload))
}
