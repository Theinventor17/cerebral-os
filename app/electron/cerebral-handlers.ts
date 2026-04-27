import { ipcMain } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { mkdir as mkdirAsync, readFile as readFileAsync, unlink as unlinkAsync, writeFile as writeFileAsync } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, normalize } from 'node:path'
import { homedir } from 'node:os'
import type DatabaseConstructor from 'better-sqlite3'
import { raEnsureSeed, raMetaGet, raMetaSet } from './ra-db'
import {
  cerebralAddRecentProject,
  cerebralGetRecentProjects,
  cerebralGetWorkspaceRoot,
  cerebralInsertTerminalExecution,
  cerebralInsertToolRequest,
  cerebralListGgufRegistry,
  cerebralListProviderLogs,
  cerebralListSkillLinks,
  cerebralListSkills,
  cerebralListTabs,
  cerebralListTerminalExecutions,
  cerebralListToolRequests,
  cerebralListWorkspaces,
  cerebralLinkSkill,
  cerebralReplaceTabs,
  cerebralSetDefaultWorkspaceRoot,
  cerebralSetToolRequestStatus,
  cerebralUpsertGguf,
  cerebralUpsertSkill,
  newCerebralId
} from './cerebral-db'
import { registerCerebralPtyIpc } from './cerebral-pty'

type SqliteDb = DatabaseConstructor.Database
type BroadcastFn = (channel: string, payload: unknown) => void

type TermRec = {
  child: ChildProcess
  buf: { out: string; err: string }
  workspaceId: string
  cwd: string
  command: string
  source: 'manual' | 'agent'
  approvalId: string | null
  startedAt: string
  db: SqliteDb
}

const termSessions = new Map<string, TermRec>()
const workspaceStreamProcs = new Map<string, ChildProcess>()

/** Windows often lacks `git` on PATH in GUI apps; prefer a standard install path when present. */
function resolveGitBinary(): string {
  if (process.platform !== 'win32') {
    return 'git'
  }
  const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
  const pfx86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const local = process.env.LocalAppData ?? ''
  const candidates = [
    join(pf, 'Git', 'cmd', 'git.exe'),
    join(pfx86, 'Git', 'cmd', 'git.exe'),
    local ? join(local, 'Programs', 'Git', 'cmd', 'git.exe') : ''
  ].filter(Boolean)
  for (const p of candidates) {
    if (existsSync(p)) {
      return p
    }
  }
  return 'git'
}

function ensureWorkspaceDirs(rootPath: string, appLog: (m: string) => void): void {
  try {
    if (!existsSync(rootPath)) {
      mkdirSync(rootPath, { recursive: true })
      appLog(`[CEREBRAL] created workspace: ${rootPath}`)
    }
  } catch (e) {
    appLog(`[CEREBRAL] workspace mkdir: ${(e as Error).message}`)
  }
}

function isCommandBlocked(line: string): { blocked: true; reason: string } | { blocked: false } {
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

function collectSpawn(
  command: string,
  cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
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

type RunOpts = {
  db: SqliteDb
  workspaceId: string
  cwd: string
  command: string
  source: 'manual' | 'agent'
  approvalRequestId: string | null
}

async function runTerminalInWorkspace(opts: RunOpts): Promise<{
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  id: string
  blocked?: string
}> {
  const g = isCommandBlocked(opts.command)
  if (g.blocked) {
    return {
      ok: false,
      exitCode: 1,
      stdout: '',
      stderr: g.reason,
      id: newCerebralId(),
      blocked: g.reason
    }
  }
  const id = newCerebralId()
  const t0 = new Date().toISOString()
  try {
    const { code, stdout, stderr } = await collectSpawn(opts.command, opts.cwd)
    const t1 = new Date().toISOString()
    const outS = String(stdout)
    const errS = String(stderr || '')
    const ok = code === 0
    cerebralInsertTerminalExecution(opts.db, {
      id,
      workspace_id: opts.workspaceId,
      cwd: opts.cwd,
      command_line: opts.command,
      source: opts.source,
      approval_request_id: opts.approvalRequestId,
      status: ok ? 'ok' : 'error',
      exit_code: code,
      stdout: outS,
      stderr: errS,
      started_at: t0,
      ended_at: t1
    })
    return { ok, exitCode: code, stdout: outS, stderr: errS, id }
  } catch (e: unknown) {
    const t1 = new Date().toISOString()
    const err = (e as Error).message
    cerebralInsertTerminalExecution(opts.db, {
      id,
      workspace_id: opts.workspaceId,
      cwd: opts.cwd,
      command_line: opts.command,
      source: opts.source,
      approval_request_id: opts.approvalRequestId,
      status: 'error',
      exit_code: 1,
      stdout: '',
      stderr: err,
      started_at: t0,
      ended_at: t1
    })
    return { ok: false, exitCode: 1, stdout: '', stderr: err, id }
  }
}

export function registerCerebralIpc(
  db: SqliteDb | null,
  appLog: (m: string) => void,
  broadcast: BroadcastFn | null = null
): void {
  const ensureDb = (): SqliteDb => {
    if (!db) {
      throw new Error('Database is not available')
    }
    raEnsureSeed(db)
    return db
  }

  const b = (channel: string, payload: unknown) => {
    broadcast?.(channel, payload)
  }

  function resolveWorkspaceRelPath(
    wid: string,
    relativePath: string
  ): { ok: true; root: string; full: string; rel: string } | { ok: false; error: string } {
    const d = ensureDb()
    let root = cerebralGetWorkspaceRoot(d, wid)
    if (!root) {
      root = join(homedir(), 'CerebralOS', 'workspaces', 'default')
    }
    ensureWorkspaceDirs(root, appLog)
    const rawRel = String(relativePath ?? '').replace(/\\/g, '/')
    const rel = normalize(rawRel)
      .replace(/^(\.\/)+/, '')
      .replace(/^\/+/, '')
    if (!rel || rel.split('/').some((p) => p === '..')) {
      return { ok: false, error: 'Invalid path' }
    }
    const full = resolve(root, rel)
    const rootResolved = resolve(root)
    const relCheck = relative(rootResolved, full)
    if (relCheck.startsWith('..') || relCheck.startsWith('..\\')) {
      return { ok: false, error: 'Path escapes workspace' }
    }
    return { ok: true, root, full, rel }
  }

  const defaultCwd = (): string => {
    const d = ensureDb()
    const g = raMetaGet(d, 'cerbral_cwd')
    if (g) {
      try {
        if (existsSync(g) && statSync(g).isDirectory()) {
          return g
        }
      } catch {
        // fall through
      }
    }
    const p = cerebralGetWorkspaceRoot(d, 'default')
    if (p) {
      ensureWorkspaceDirs(p, appLog)
      return p
    }
    return join(homedir(), 'CerebralOS', 'workspaces', 'default')
  }

  ipcMain.handle('cerebral:workspace:default', () => {
    const d = ensureDb()
    const p = cerebralGetWorkspaceRoot(d, 'default') || join(homedir(), 'CerebralOS', 'workspaces', 'default')
    ensureWorkspaceDirs(p, appLog)
    return {
      id: 'default',
      rootPath: p,
      name: 'default'
    }
  })

  ipcMain.handle('cerebral:workspace:list', () => {
    return cerebralListWorkspaces(ensureDb())
  })

  ipcMain.handle('cerebral:workspace:recent', () => {
    return cerebralGetRecentProjects(ensureDb())
  })

  /** Write a file under the workspace root; rejects path traversal. */
  ipcMain.handle(
    'cerebral:workspace:writeFile',
    (
      _e,
      a: { relativePath: string; content: string; workspaceId?: string }
    ): { ok: true; path: string } | { ok: false; error: string } => {
      const d = ensureDb()
      const wid = a.workspaceId || 'default'
      let root = cerebralGetWorkspaceRoot(d, wid)
      if (!root) {
        root = join(homedir(), 'CerebralOS', 'workspaces', 'default')
      }
      ensureWorkspaceDirs(root, appLog)
      const rawRel = String(a.relativePath ?? '').replace(/\\/g, '/')
      const rel = normalize(rawRel)
        .replace(/^(\.\/)+/, '')
        .replace(/^\/+/, '')
      if (!rel || rel.split('/').some((p) => p === '..')) {
        return { ok: false, error: 'Invalid path' }
      }
      if (a.content.length > 2_500_000) {
        return { ok: false, error: 'Content too large' }
      }
      const full = resolve(root, rel)
      const rootResolved = resolve(root)
      const relCheck = relative(rootResolved, full)
      if (relCheck.startsWith('..') || relCheck.startsWith('..\\')) {
        return { ok: false, error: 'Path escapes workspace' }
      }
      try {
        const dir = dirname(full)
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        writeFileSync(full, a.content, 'utf8')
        return { ok: true, path: full }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )

  /** Read a UTF-8 file under the workspace root; rejects path traversal. */
  ipcMain.handle(
    'cerebral:workspace:readFile',
    (
      _e,
      a: { relativePath: string; workspaceId?: string }
    ): { ok: true; path: string; content: string } | { ok: false; error: string } => {
      const d = ensureDb()
      const wid = a.workspaceId || 'default'
      let root = cerebralGetWorkspaceRoot(d, wid)
      if (!root) {
        root = join(homedir(), 'CerebralOS', 'workspaces', 'default')
      }
      const rawRel = String(a.relativePath ?? '').replace(/\\/g, '/')
      const rel = normalize(rawRel)
        .replace(/^(\.\/)+/, '')
        .replace(/^\/+/, '')
      if (!rel || rel.split('/').some((p) => p === '..')) {
        return { ok: false, error: 'Invalid path' }
      }
      const full = resolve(root, rel)
      const rootResolved = resolve(root)
      const relCheck = relative(rootResolved, full)
      if (relCheck.startsWith('..') || relCheck.startsWith('..\\')) {
        return { ok: false, error: 'Path escapes workspace' }
      }
      try {
        if (!existsSync(full) || !statSync(full).isFile()) {
          return { ok: false, error: 'Not a file or does not exist' }
        }
        const st = statSync(full)
        if (st.size > 1_500_000) {
          return { ok: false, error: 'File too large (max ~1.5 MB for read)' }
        }
        const content = readFileSync(full, 'utf8')
        return { ok: true, path: full, content }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'cerebral:workspace:editFile',
    async (
      _e,
      a: { relativePath: string; find: string; replace: string; replaceAll?: boolean; workspaceId?: string }
    ): Promise<{ ok: true; path: string } | { ok: false; error: string }> => {
      const wid = a.workspaceId || 'default'
      const res = resolveWorkspaceRelPath(wid, a.relativePath)
      if (!res.ok) {
        return res
      }
      const find = String(a.find ?? '')
      const rep = String(a.replace ?? '')
      if (!find) {
        return { ok: false, error: 'find is empty' }
      }
      try {
        if (!existsSync(res.full) || !statSync(res.full).isFile()) {
          return { ok: false, error: 'Not a file or does not exist' }
        }
        const st = statSync(res.full)
        if (st.size > 1_500_000) {
          return { ok: false, error: 'File too large' }
        }
        let body = await readFileAsync(res.full, 'utf8')
        if (!body.includes(find)) {
          return { ok: false, error: 'find string not found in file' }
        }
        if (a.replaceAll) {
          body = body.split(find).join(rep)
        } else {
          body = body.replace(find, rep)
        }
        await writeFileAsync(res.full, body, 'utf8')
        return { ok: true, path: res.full }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'cerebral:workspace:deleteFile',
    async (
      _e,
      a: { relativePath: string; workspaceId?: string }
    ): Promise<{ ok: true; path: string } | { ok: false; error: string }> => {
      const wid = a.workspaceId || 'default'
      const res = resolveWorkspaceRelPath(wid, a.relativePath)
      if (!res.ok) {
        return res
      }
      try {
        if (!existsSync(res.full)) {
          return { ok: false, error: 'Path does not exist' }
        }
        if (!statSync(res.full).isFile()) {
          return { ok: false, error: 'Not a file (refuse to delete non-file)' }
        }
        await unlinkAsync(res.full)
        return { ok: true, path: res.full }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'cerebral:workspace:createDirectory',
    async (
      _e,
      a: { relativePath: string; workspaceId?: string }
    ): Promise<{ ok: true; path: string } | { ok: false; error: string }> => {
      const wid = a.workspaceId || 'default'
      const res = resolveWorkspaceRelPath(wid, a.relativePath)
      if (!res.ok) {
        return res
      }
      try {
        await mkdirAsync(res.full, { recursive: true })
        return { ok: true, path: res.full }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'cerebral:workspace:runCommandStream',
    async (
      _e,
      a: { runId: string; command: string; workspaceId?: string }
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      const runId = String(a.runId ?? '')
      if (!runId) {
        return { ok: false, error: 'runId required' }
      }
      const cmd = String(a.command ?? '').trim()
      const g = isCommandBlocked(cmd)
      if (g.blocked) {
        b('cerebral:workspace:commandExit', { runId, code: 1, signal: null, error: g.reason })
        return { ok: false, error: g.reason }
      }
      const d = ensureDb()
      const wid = a.workspaceId || 'default'
      let root = cerebralGetWorkspaceRoot(d, wid)
      if (!root) {
        root = join(homedir(), 'CerebralOS', 'workspaces', 'default')
      }
      ensureWorkspaceDirs(root, appLog)
      try {
        const child = spawn(cmd, {
          shell: true,
          cwd: root,
          windowsHide: true,
          env: { ...process.env, NODE_OPTIONS: undefined }
        })
        workspaceStreamProcs.set(runId, child)
        const emit = (stream: 'stdout' | 'stderr', data: string) => {
          b('cerebral:workspace:commandChunk', { runId, stream, data })
        }
        child.stdout?.on('data', (c) => {
          emit('stdout', c.toString())
        })
        child.stderr?.on('data', (c) => {
          emit('stderr', c.toString())
        })
        child.on('error', (err) => {
          emit('stderr', (err as Error).message + '\n')
          b('cerebral:workspace:commandExit', { runId, code: 1, signal: null, error: (err as Error).message })
          workspaceStreamProcs.delete(runId)
        })
        child.on('close', (code, signal) => {
          workspaceStreamProcs.delete(runId)
          b('cerebral:workspace:commandExit', { runId, code: code ?? (signal ? 1 : 0), signal: signal != null ? String(signal) : null })
        })
        return { ok: true }
      } catch (e) {
        b('cerebral:workspace:commandExit', { runId, code: 1, signal: null, error: (e as Error).message })
        return { ok: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(
    'cerebral:workspace:setRoot',
    (
      _e,
      a: {
        rootPath: string
        displayName?: string
      }
    ) => {
      const d = ensureDb()
      const p = a.rootPath
      if (!p || !existsSync(p) || !statSync(p).isDirectory()) {
        return { ok: false as const, error: 'Path must be an existing directory' }
      }
      const label = (a.displayName && a.displayName.trim()) || basename(p)
      ensureWorkspaceDirs(p, appLog)
      cerebralSetDefaultWorkspaceRoot(d, p, label)
      cerebralAddRecentProject(d, label, p)
      raMetaSet(d, 'cerbral_cwd', p)
      return { ok: true as const, rootPath: p, name: label }
    }
  )

  ipcMain.handle('cerebral:git:clone', async (_e, a: { parentDir: string; url: string }) => {
    const d = ensureDb()
    const url = a.url?.trim()
    if (!url || !a.parentDir) {
      return { ok: false, error: 'Repository URL and parent folder are required' }
    }
    if (!existsSync(a.parentDir) || !statSync(a.parentDir).isDirectory()) {
      return { ok: false, error: 'Parent folder is not valid' }
    }
    const baseName =
      url
        .split(/[\\/]/)
        .filter(Boolean)
        .pop()
        ?.replace(/\.git$/i, '') || 'repo'
    const target = join(a.parentDir, baseName)
    if (existsSync(target)) {
      return { ok: false, error: `A folder already exists: ${baseName}` }
    }
    return await new Promise<{ ok: boolean; error?: string; rootPath?: string; name?: string }>((resolve) => {
      const isWin = process.platform === 'win32'
      const gitBin = resolveGitBinary()
      const child = isWin
        ? spawn(gitBin, ['clone', url, target], { cwd: a.parentDir, windowsHide: true })
        : spawn(gitBin, ['clone', url, baseName], { cwd: a.parentDir, env: { ...process.env, NODE_OPTIONS: undefined } })
      let err = ''
      child.stderr?.on('data', (c) => {
        err += c.toString()
      })
      child.on('error', (e) => {
        resolve({ ok: false, error: (e as Error).message || 'git not found' })
      })
      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ ok: false, error: err.trim() || `git clone exited with ${String(code)}` })
          return
        }
        if (!existsSync(target) || !statSync(target).isDirectory()) {
          resolve({ ok: false, error: 'Clone finished but folder was not found' })
          return
        }
        const label = basename(target)
        ensureWorkspaceDirs(target, appLog)
        cerebralSetDefaultWorkspaceRoot(d, target, label)
        cerebralAddRecentProject(d, label, target)
        raMetaSet(d, 'cerbral_cwd', target)
        resolve({ ok: true, rootPath: target, name: label })
      })
    })
  })

  ipcMain.handle('cerebral:tabs:get', (_e, workspaceId: string) => {
    return cerebralListTabs(ensureDb(), workspaceId || 'default')
  })

  ipcMain.handle(
    'cerebral:tabs:replace',
    (
      _e,
      a: { workspaceId: string; tabs: Array<{ id: string; title: string; type: string; data_json: string | null; sort_order: number; is_dirty: number }> }
    ) => {
      cerebralReplaceTabs(ensureDb(), a.workspaceId || 'default', a.tabs)
    }
  )

  ipcMain.handle('cerebral:terminal:run', async (_e, a: { workspaceId: string; cwd: string; command: string; source: 'manual' | 'agent'; approvalId?: string | null }) => {
    const d = ensureDb()
    return runTerminalInWorkspace({
      db: d,
      workspaceId: a.workspaceId || 'default',
      cwd: a.cwd,
      command: a.command,
      source: a.source,
      approvalRequestId: a.approvalId ?? null
    })
  })

  function startTermSession(a: {
    workspaceId: string
    cwd: string
    command: string
    source: 'manual' | 'agent'
    approvalId?: string | null
  }): { sessionId: string | null; blocked?: string } {
    const d = ensureDb()
    const g = isCommandBlocked(a.command)
    if (g.blocked) {
      return { sessionId: null, blocked: g.reason }
    }
    const sessionId = newCerebralId()
    const t0 = new Date().toISOString()
    const isWin = process.platform === 'win32'
    const child = isWin
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', a.command], {
          cwd: a.cwd,
          windowsHide: true,
          env: { ...process.env, NODE_OPTIONS: undefined }
        })
      : spawn('/bin/sh', ['-c', a.command], { cwd: a.cwd, env: { ...process.env, NODE_OPTIONS: undefined } })
    const buf = { out: '', err: '' }
    const meta = { source: a.source, command: a.command }
    termSessions.set(sessionId, {
      child,
      buf,
      workspaceId: a.workspaceId || 'default',
      cwd: a.cwd,
      command: a.command,
      source: a.source,
      approvalId: a.approvalId ?? null,
      startedAt: t0,
      db: d
    })
    const emitMeta = (extra?: Record<string, unknown>) => ({
      sessionId,
      source: meta.source,
      command: a.command,
      ...extra
    })
    child.stdout?.on('data', (c) => {
      const t = c.toString()
      buf.out += t
      b('cerebral:terminal:chunk', emitMeta({ stream: 'stdout' as const, data: t }))
    })
    child.stderr?.on('data', (c) => {
      const t = c.toString()
      buf.err += t
      b('cerebral:terminal:chunk', emitMeta({ stream: 'stderr' as const, data: t }))
    })
    child.on('error', (err) => {
      b('cerebral:terminal:chunk', emitMeta({ stream: 'stderr' as const, data: (err as Error).message + '\n' }))
      b('cerebral:terminal:exit', emitMeta({ code: 1, signal: null, error: (err as Error).message }))
      termSessions.delete(sessionId)
    })
    child.on('close', (code, signal) => {
      const rec = termSessions.get(sessionId)
      termSessions.delete(sessionId)
      const exit = code ?? (signal ? 1 : 0)
      b('cerebral:terminal:exit', emitMeta({ code: exit, signal: signal != null ? String(signal) : null }))
      if (rec) {
        const t1 = new Date().toISOString()
        cerebralInsertTerminalExecution(rec.db, {
          id: newCerebralId(),
          workspace_id: rec.workspaceId,
          cwd: rec.cwd,
          command_line: rec.command,
          source: rec.source,
          approval_request_id: rec.approvalId,
          status: exit === 0 ? 'ok' : 'error',
          exit_code: exit,
          stdout: rec.buf.out,
          stderr: rec.buf.err,
          started_at: rec.startedAt,
          ended_at: t1
        })
      }
    })
    return { sessionId }
  }

  ipcMain.handle('cerebral:terminal:getCwd', () => {
    return { path: defaultCwd() }
  })

  ipcMain.handle('cerebral:terminal:setCwd', (_e, p: string) => {
    const d = ensureDb()
    if (!p || !existsSync(p) || !statSync(p).isDirectory()) {
      return { ok: false, error: 'Path must be an existing directory' }
    }
    raMetaSet(d, 'cerbral_cwd', p)
    return { ok: true, path: p }
  })

  ipcMain.handle(
    'cerebral:terminal:start',
    (
      _e,
      a: { workspaceId: string; cwd: string; command: string; source: 'manual' | 'agent'; approvalId?: string | null }
    ) => {
      const r = startTermSession(a)
      if (r.blocked) {
        return { sessionId: null as string | null, blocked: r.blocked }
      }
      return { sessionId: r.sessionId, blocked: undefined }
    }
  )

  ipcMain.handle('cerebral:terminal:cancel', (_e, sessionId: string) => {
    const r = termSessions.get(sessionId)
    if (!r) {
      return { ok: false, error: 'No running session' }
    }
    try {
      r.child.kill('SIGTERM')
    } catch {
      r.child.kill()
    }
    b('cerebral:terminal:exit', {
      sessionId,
      code: 130,
      signal: 'SIGTERM',
      cancelled: true,
      source: r.source,
      command: r.command
    })
    termSessions.delete(sessionId)
    return { ok: true }
  })

  ipcMain.handle('cerebral:terminal:history', (_e, limit: number) => {
    return cerebralListTerminalExecutions(ensureDb(), limit ?? 100)
  })

  ipcMain.handle('cerebral:toolRequest:list', (_e, status?: string) => {
    return cerebralListToolRequests(ensureDb(), status)
  })

  ipcMain.handle('cerebral:toolRequest:submit', (_e, body: Record<string, unknown>) => {
    const d = ensureDb()
    const id = newCerebralId()
    const tool = String(body.tool ?? 'unknown')
    const command = String(body.command ?? body.command_text ?? '')
    const reason = body.reason == null ? null : String(body.reason)
    const risk = String((body as { riskLevel?: string }).riskLevel ?? (body as { risk_level?: string }).risk_level ?? 'medium')
    const sessionId = body.sessionId == null ? null : String(body.sessionId)
    const agentId = body.agentId == null ? null : String(body.agentId)
    const json = JSON.stringify({
      type: 'tool_request',
      tool,
      command,
      reason: reason ?? '',
      riskLevel: risk
    })
    cerebralInsertToolRequest(d, {
      id,
      session_id: sessionId,
      agent_id: agentId,
      tool,
      command_text: command,
      reason,
      risk_level: risk,
      status: 'pending',
      request_json: json
    })
    return { id, ok: true }
  })

  ipcMain.handle('cerebral:toolRequest:decide', async (_e, a: { id: string; approved: boolean }) => {
    const d = ensureDb()
    const row = d
      .prepare('SELECT * FROM tool_approval_requests WHERE id = ?')
      .get(a.id) as Record<string, unknown> | undefined
    if (!row) {
      return { ok: false, error: 'Request not found' }
    }
    if (String(row.status) !== 'pending') {
      return { ok: false, error: 'Request already decided' }
    }
    if (!a.approved) {
      cerebralSetToolRequestStatus(d, a.id, 'rejected')
      return { ok: true, ran: null as null }
    }
    cerebralSetToolRequestStatus(d, a.id, 'approved')
    const req = JSON.parse(String(row.request_json)) as { tool: string; command: string }
    if (req.tool === 'shell' && req.command) {
      const cwd = defaultCwd()
      const r = startTermSession({
        workspaceId: 'default',
        cwd,
        command: req.command,
        source: 'agent',
        approvalId: a.id
      })
      if (r.blocked) {
        return {
          ok: false,
          error: r.blocked,
          ran: { exitCode: 1, stdout: '', stderr: r.blocked, blocked: r.blocked, streaming: false as const }
        }
      }
      return {
        ok: true,
        ran: {
          exitCode: 0,
          stdout: '',
          stderr: '',
          streaming: true as const,
          sessionId: r.sessionId
        }
      }
    }
    return { ok: true, ran: null as null }
  })

  ipcMain.handle('cerebral:providerLog:list', (_e, limit: number) => {
    return cerebralListProviderLogs(ensureDb(), limit ?? 200)
  })

  ipcMain.handle('cerebral:skill:list', () => {
    return cerebralListSkills(ensureDb())
  })

  ipcMain.handle(
    'cerebral:skill:upsert',
    (
      _e,
      r: {
        id: string
        name: string
        description: string
        version: string | null
        source: string
        skill_path: string | null
        instructions: string
        tools_json: string | null
        triggers_json: string | null
        compatible_agents_json: string | null
        enabled: number
      }
    ) => {
      cerebralUpsertSkill(ensureDb(), r)
    }
  )

  ipcMain.handle('cerebral:skill:links', (_e, agentId: string) => {
    return cerebralListSkillLinks(ensureDb(), agentId)
  })

  ipcMain.handle('cerebral:skill:link', (_e, a: { agentId: string; skillId: string }) => {
    cerebralLinkSkill(ensureDb(), a.agentId, a.skillId)
  })

  ipcMain.handle('cerebral:gguf:list', () => {
    return cerebralListGgufRegistry(ensureDb())
  })

  ipcMain.handle(
    'cerebral:gguf:upsert',
    (
      _e,
      r: {
        id: string
        name: string
        file_path: string
        runtime: string
        status: string
      }
    ) => {
      cerebralUpsertGguf(ensureDb(), r)
    }
  )

  registerCerebralPtyIpc(defaultCwd, b)
}
