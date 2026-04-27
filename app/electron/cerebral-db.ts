import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { raMetaGet, raMetaSet } from './ra-db'

const now = () => new Date().toISOString()

const RECENT_META = 'cerbral_recent_projects_v1'
const MAX_RECENT = 32

export type CerebralRecentProject = {
  name: string
  path: string
  openedAt: string
}

export function cerebralSetDefaultWorkspaceRoot(
  db: Database.Database,
  rootPath: string,
  displayName: string
): void {
  db.prepare('UPDATE cerbral_workspaces SET root_path = ?, name = ? WHERE id = ?').run(
    rootPath,
    displayName,
    'default'
  )
}

export function cerebralGetRecentProjects(db: Database.Database): CerebralRecentProject[] {
  const raw = raMetaGet(db, RECENT_META)
  if (!raw) {
    return []
  }
  try {
    const a = JSON.parse(raw) as CerebralRecentProject[]
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

export function cerebralAddRecentProject(db: Database.Database, name: string, projectPath: string): void {
  const prev = cerebralGetRecentProjects(db).filter((e) => e.path !== projectPath)
  const next: CerebralRecentProject[] = [
    { name, path: projectPath, openedAt: new Date().toISOString() },
    ...prev
  ].slice(0, MAX_RECENT)
  raMetaSet(db, RECENT_META, JSON.stringify(next))
}

export function cerebralListWorkspaces(db: Database.Database): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM cerbral_workspaces ORDER BY name ASC').all() as Array<Record<string, unknown>>
}

export function cerebralGetWorkspaceRoot(db: Database.Database, id: string): string | null {
  const row = db.prepare('SELECT root_path FROM cerbral_workspaces WHERE id = ?').get(id) as { root_path: string } | undefined
  return row?.root_path ?? null
}

export function cerebralListTabs(db: Database.Database, workspaceId: string): Array<Record<string, unknown>> {
  return db
    .prepare('SELECT * FROM cerbral_tabs WHERE workspace_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(workspaceId) as Array<Record<string, unknown>>
}

export function cerebralReplaceTabs(
  db: Database.Database,
  workspaceId: string,
  rows: Array<{
    id: string
    title: string
    type: string
    data_json: string | null
    sort_order: number
    is_dirty: number
  }>
): void {
  const del = db.prepare('DELETE FROM cerbral_tabs WHERE workspace_id = ?')
  const ins = db.prepare(
    `INSERT INTO cerbral_tabs (id, workspace_id, title, type, data_json, sort_order, is_dirty, created_at, updated_at)
     VALUES (@id, @workspace_id, @title, @type, @data_json, @sort_order, @is_dirty, @created_at, @updated_at)`
  )
  const t = now()
  del.run(workspaceId)
  for (const r of rows) {
    ins.run({
      ...r,
      workspace_id: workspaceId,
      created_at: t,
      updated_at: t
    })
  }
}

export function cerebralListToolRequests(
  db: Database.Database,
  status?: string
): Array<Record<string, unknown>> {
  if (status) {
    return db
      .prepare('SELECT * FROM tool_approval_requests WHERE status = ? ORDER BY created_at DESC')
      .all(status) as Array<Record<string, unknown>>
  }
  return db
    .prepare('SELECT * FROM tool_approval_requests ORDER BY created_at DESC LIMIT 200')
    .all() as Array<Record<string, unknown>>
}

export function cerebralInsertToolRequest(
  db: Database.Database,
  r: {
    id: string
    session_id: string | null
    agent_id: string | null
    tool: string
    command_text: string
    reason: string | null
    risk_level: string
    status: string
    request_json: string
  }
): void {
  db.prepare(
    `INSERT INTO tool_approval_requests (id, session_id, agent_id, tool, command_text, reason, risk_level, status, request_json, created_at, decided_at)
     VALUES (@id, @session_id, @agent_id, @tool, @command_text, @reason, @risk_level, @status, @request_json, @created_at, NULL)`
  ).run({ ...r, created_at: now() })
}

export function cerebralSetToolRequestStatus(
  db: Database.Database,
  id: string,
  status: 'approved' | 'rejected' | 'cancelled'
): void {
  db.prepare('UPDATE tool_approval_requests SET status = ?, decided_at = ? WHERE id = ?').run(status, now(), id)
}

export function cerebralInsertTerminalExecution(
  db: Database.Database,
  r: {
    id: string
    workspace_id: string
    cwd: string
    command_line: string
    source: string
    approval_request_id: string | null
    status: string
    exit_code: number | null
    stdout: string
    stderr: string
    started_at: string
    ended_at: string
  }
): void {
  db.prepare(
    `INSERT INTO terminal_executions (id, workspace_id, cwd, command_line, source, approval_request_id, status, exit_code, stdout, stderr, started_at, ended_at)
     VALUES (@id, @workspace_id, @cwd, @command_line, @source, @approval_request_id, @status, @exit_code, @stdout, @stderr, @started_at, @ended_at)`
  ).run(r)
}

export function cerebralListTerminalExecutions(db: Database.Database, limit: number): Array<Record<string, unknown>> {
  return db
    .prepare('SELECT * FROM terminal_executions ORDER BY started_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>
}

export function cerebralInsertProviderLog(
  db: Database.Database,
  r: {
    id: string
    provider_id: string | null
    model_name: string | null
    agent_id: string | null
    success: number
    error_message: string | null
    request_summary: string | null
  }
): void {
  db.prepare(
    `INSERT INTO provider_logs (id, provider_id, model_name, agent_id, success, error_message, request_summary, created_at)
     VALUES (@id, @provider_id, @model_name, @agent_id, @success, @error_message, @request_summary, @created_at)`
  ).run({ ...r, created_at: now() })
}

export function cerebralListProviderLogs(db: Database.Database, limit: number): Array<Record<string, unknown>> {
  return db
    .prepare('SELECT * FROM provider_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>
}

export function cerebralListSkills(db: Database.Database): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM cerbral_skills ORDER BY name ASC').all() as Array<Record<string, unknown>>
}

export function cerebralUpsertSkill(
  db: Database.Database,
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
): void {
  const existing = db.prepare('SELECT created_at FROM cerbral_skills WHERE id = ?').get(r.id) as { created_at: string } | undefined
  const t = now()
  if (existing) {
    db.prepare(
      `UPDATE cerbral_skills SET name=@name, description=@description, version=@version, source=@source, skill_path=@skill_path,
        instructions=@instructions, tools_json=@tools_json, triggers_json=@triggers_json, compatible_agents_json=@compatible_agents_json,
        enabled=@enabled, updated_at=@updated_at WHERE id=@id`
    ).run({ ...r, updated_at: t, id: r.id })
  } else {
    db.prepare(
      `INSERT INTO cerbral_skills (id, name, description, version, source, skill_path, instructions, tools_json, triggers_json, compatible_agents_json, enabled, created_at, updated_at)
       VALUES (@id, @name, @description, @version, @source, @skill_path, @instructions, @tools_json, @triggers_json, @compatible_agents_json, @enabled, @created_at, @updated_at)`
    ).run({ ...r, created_at: t, updated_at: t })
  }
}

export function cerebralListSkillLinks(db: Database.Database, agentId: string): string[] {
  return (
    db
      .prepare('SELECT skill_id FROM agent_skill_links WHERE agent_id = ?')
      .all(agentId) as Array<{ skill_id: string }>
  ).map((x) => x.skill_id)
}

export function cerebralLinkSkill(db: Database.Database, agentId: string, skillId: string): void {
  db.prepare('INSERT OR REPLACE INTO agent_skill_links (agent_id, skill_id) VALUES (?, ?)').run(agentId, skillId)
}

export function cerebralListGgufRegistry(db: Database.Database): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM cerbral_gguf_registry ORDER BY name ASC').all() as Array<Record<string, unknown>>
}

export function cerebralUpsertGguf(
  db: Database.Database,
  r: {
    id: string
    name: string
    file_path: string
    runtime: string
    status: string
  }
): void {
  const t = now()
  const ex = db.prepare('SELECT created_at FROM cerbral_gguf_registry WHERE id = ?').get(r.id) as { created_at: string } | undefined
  if (ex) {
    db.prepare(
      'UPDATE cerbral_gguf_registry SET name=?, file_path=?, runtime=?, status=?, updated_at=? WHERE id=?'
    ).run(r.name, r.file_path, r.runtime, r.status, t, r.id)
  } else {
    db.prepare(
      'INSERT INTO cerbral_gguf_registry (id, name, file_path, runtime, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(r.id, r.name, r.file_path, r.runtime, r.status, t, t)
  }
}

export function newCerebralId(): string {
  return randomUUID()
}
