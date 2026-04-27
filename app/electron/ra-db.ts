import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export type RaProviderRow = {
  id: string
  name: string
  type: string
  endpoint_url: string
  model_name: string
  enabled: number
  local_only: number
  context_window: number | null
  temperature: number | null
  max_output_tokens: number | null
  privacy_mode: number | null
  default_chat: number
  default_planning: number
  default_coding: number
  default_report: number
  default_local_private: number
  local_gguf_path: string | null
  hf_import_url: string | null
  created_at: string
  updated_at: string
}

export type RaAgentRow = {
  id: string
  name: string
  role: string
  description: string
  color: string
  icon: string
  status: string
  provider_id: string
  model_name: string
  system_prompt: string
  memory_enabled: number
  tools_enabled_json: string
  permissions_json: string
  workspace_id: string
  temperature: number | null
  max_output_tokens: number | null
  created_at: string
  updated_at: string
}

const now = () => new Date().toISOString()

const DEFAULT_PROVIDERS: RaProviderRow[] = [
  {
    id: 'ra-prov-ollama',
    name: 'Ollama (local)',
    type: 'ollama',
    endpoint_url: 'http://localhost:11434/v1/chat/completions',
    model_name: 'llama3.2',
    enabled: 1,
    local_only: 1,
    context_window: 8192,
    temperature: 0.3,
    max_output_tokens: 4096,
    privacy_mode: 1,
    default_chat: 1,
    default_planning: 0,
    default_coding: 0,
    default_report: 0,
    default_local_private: 1,
    local_gguf_path: null,
    hf_import_url: null,
    created_at: now(),
    updated_at: now()
  },
  {
    id: 'ra-prov-lmstudio',
    name: 'LM Studio',
    type: 'lmstudio',
    endpoint_url: 'http://localhost:1234/v1/chat/completions',
    model_name: 'local-model',
    enabled: 0,
    local_only: 1,
    context_window: 8192,
    temperature: 0.25,
    max_output_tokens: 4096,
    privacy_mode: 1,
    default_chat: 0,
    default_planning: 0,
    default_coding: 0,
    default_report: 0,
    default_local_private: 0,
    local_gguf_path: null,
    hf_import_url: null,
    created_at: now(),
    updated_at: now()
  },
  {
    id: 'ra-prov-llamacpp',
    name: 'llama.cpp server',
    type: 'llama_cpp',
    endpoint_url: 'http://localhost:8080/v1/chat/completions',
    model_name: 'gpt-3.5-turbo',
    enabled: 0,
    local_only: 1,
    context_window: 4096,
    temperature: 0.2,
    max_output_tokens: 2048,
    privacy_mode: 1,
    default_chat: 0,
    default_planning: 0,
    default_coding: 0,
    default_report: 0,
    default_local_private: 0,
    local_gguf_path: null,
    hf_import_url: null,
    created_at: now(),
    updated_at: now()
  },
  {
    id: 'ra-prov-openrouter',
    name: 'OpenRouter',
    type: 'openrouter',
    endpoint_url: 'https://openrouter.ai/api/v1/chat/completions',
    model_name: 'openai/gpt-4o-mini',
    enabled: 0,
    local_only: 0,
    context_window: 128000,
    temperature: 0.2,
    max_output_tokens: 4096,
    privacy_mode: 0,
    default_chat: 0,
    default_planning: 0,
    default_coding: 0,
    default_report: 0,
    default_local_private: 0,
    local_gguf_path: null,
    hf_import_url: null,
    created_at: now(),
    updated_at: now()
  },
  {
    id: 'ra-prov-openai',
    name: 'OpenAI',
    type: 'openai',
    endpoint_url: 'https://api.openai.com/v1/chat/completions',
    model_name: 'gpt-4o-mini',
    enabled: 0,
    local_only: 0,
    context_window: 128000,
    temperature: 0.2,
    max_output_tokens: 4096,
    privacy_mode: 0,
    default_chat: 0,
    default_planning: 0,
    default_coding: 0,
    default_report: 0,
    default_local_private: 0,
    local_gguf_path: null,
    hf_import_url: null,
    created_at: now(),
    updated_at: now()
  },
  {
    id: 'ra-prov-anthropic',
    name: 'Anthropic Claude',
    type: 'anthropic',
    endpoint_url: 'https://api.anthropic.com/v1/messages',
    model_name: 'claude-3-5-sonnet-20241022',
    enabled: 0,
    local_only: 0,
    context_window: 200000,
    temperature: 0.2,
    max_output_tokens: 4096,
    privacy_mode: 0,
    default_chat: 0,
    default_planning: 0,
    default_coding: 0,
    default_report: 0,
    default_local_private: 0,
    local_gguf_path: null,
    hf_import_url: null,
    created_at: now(),
    updated_at: now()
  },
  {
    id: 'ra-prov-gemini',
    name: 'Google Gemini',
    type: 'gemini',
    endpoint_url: 'https://generativelanguage.googleapis.com/v1beta',
    model_name: 'gemini-1.5-flash',
    enabled: 0,
    local_only: 0,
    context_window: 1000000,
    temperature: 0.2,
    max_output_tokens: 4096,
    privacy_mode: 0,
    default_chat: 0,
    default_planning: 0,
    default_coding: 0,
    default_report: 0,
    default_local_private: 0,
    local_gguf_path: null,
    hf_import_url: null,
    created_at: now(),
    updated_at: now()
  },
  {
    id: 'ra-prov-custom',
    name: 'Custom OpenAI endpoint',
    type: 'custom_openai',
    endpoint_url: 'http://127.0.0.1:5000/v1/chat/completions',
    model_name: 'default',
    enabled: 0,
    local_only: 0,
    context_window: 8192,
    temperature: 0.2,
    max_output_tokens: 4096,
    privacy_mode: 0,
    default_chat: 0,
    default_planning: 0,
    default_coding: 0,
    default_report: 0,
    default_local_private: 0,
    local_gguf_path: null,
    hf_import_url: null,
    created_at: now(),
    updated_at: now()
  },
  {
    id: 'ra-prov-gguf',
    name: 'Local GGUF (llama.cpp)',
    type: 'local_gguf',
    endpoint_url: 'http://localhost:8080/v1/chat/completions',
    model_name: 'local-gguf',
    enabled: 0,
    local_only: 1,
    context_window: 4096,
    temperature: 0.2,
    max_output_tokens: 2048,
    privacy_mode: 1,
    default_chat: 0,
    default_planning: 0,
    default_coding: 0,
    default_report: 0,
    default_local_private: 0,
    local_gguf_path: null,
    hf_import_url: null,
    created_at: now(),
    updated_at: now()
  }
]

function defaultPermissionsJson(): string {
  const scopes = [
    'read_files',
    'write_files',
    'shell',
    'browser',
    'email',
    'calendar',
    'api_call',
    'webhook',
    'local_app',
    'memory_write'
  ] as const
  return JSON.stringify(
    scopes.map((scope, i) => ({
      id: `perm-${i}`,
      label: scope.replace(/_/g, ' '),
      scope,
      mode: 'ask_each_time' as const
    }))
  )
}

const DEFAULT_AGENTS: Omit<RaAgentRow, 'created_at' | 'updated_at'>[] = [
  {
    id: 'ra-agent-harmony',
    name: 'Harmony',
    role: 'Emotional intelligence & support',
    description: 'Emotional intelligence, reflection, prioritization, and empathetic support.',
    color: '#9B5CFF',
    icon: 'heart',
    status: 'online',
    provider_id: 'ra-prov-ollama',
    model_name: 'llama3.2',
    system_prompt: 'You are Harmony, focused on emotional intelligence, reflection, and supportive guidance.',
    memory_enabled: 1,
    tools_enabled_json: JSON.stringify(['memory', 'chat']),
    permissions_json: defaultPermissionsJson(),
    workspace_id: 'default',
    temperature: null,
    max_output_tokens: null
  },
  {
    id: 'ra-agent-sage',
    name: 'Sage',
    role: 'Research & analysis',
    description: 'Research, analysis, summarization, and structured planning.',
    color: '#18C7FF',
    icon: 'tree',
    status: 'online',
    provider_id: 'ra-prov-ollama',
    model_name: 'llama3.2',
    system_prompt: 'You are Sage, a research and analysis specialist. Be precise and well structured.',
    memory_enabled: 1,
    tools_enabled_json: JSON.stringify(['memory', 'chat', 'web_read']),
    permissions_json: defaultPermissionsJson(),
    workspace_id: 'default',
    temperature: null,
    max_output_tokens: null
  },
  {
    id: 'ra-agent-forge',
    name: 'Forge',
    role: 'Code & automation',
    description: 'Code, build, automation, and technical tooling.',
    color: '#FF7A18',
    icon: 'cube',
    status: 'online',
    provider_id: 'ra-prov-ollama',
    model_name: 'llama3.2',
    system_prompt: 'You are Forge, focused on code, automation, and build tasks.',
    memory_enabled: 1,
    tools_enabled_json: JSON.stringify(['memory', 'chat', 'shell_readonly']),
    permissions_json: defaultPermissionsJson(),
    workspace_id: 'default',
    temperature: null,
    max_output_tokens: null
  },
  {
    id: 'ra-agent-oracle',
    name: 'Oracle',
    role: 'Strategy & decisions',
    description: 'Strategy, forecasting, and decision support.',
    color: '#FFCC33',
    icon: 'eye',
    status: 'online',
    provider_id: 'ra-prov-ollama',
    model_name: 'llama3.2',
    system_prompt: 'You are Oracle, a strategic advisor. Surface tradeoffs and long-term implications.',
    memory_enabled: 1,
    tools_enabled_json: JSON.stringify(['memory', 'chat']),
    permissions_json: defaultPermissionsJson(),
    workspace_id: 'default',
    temperature: null,
    max_output_tokens: null
  },
  {
    id: 'ra-agent-lumen',
    name: 'Lumen',
    role: 'Creative & media',
    description: 'Creative visualization, media, branding, and image prompt craft.',
    color: '#B344FF',
    icon: 'star',
    status: 'online',
    provider_id: 'ra-prov-ollama',
    model_name: 'llama3.2',
    system_prompt: 'You are Lumen, focused on creative visualization and image-oriented prompts.',
    memory_enabled: 1,
    tools_enabled_json: JSON.stringify(['memory', 'chat', 'image_brief']),
    permissions_json: defaultPermissionsJson(),
    workspace_id: 'default',
    temperature: null,
    max_output_tokens: null
  },
  {
    id: 'ra-agent-nexus',
    name: 'Nexus',
    role: 'Operations & routing',
    description: 'System operations, routing, automations, and orchestration patterns.',
    color: '#35F28A',
    icon: 'network',
    status: 'online',
    provider_id: 'ra-prov-ollama',
    model_name: 'llama3.2',
    system_prompt: 'You are Nexus, coordinating workflows and system-level routing. Keep answers concise and actionable.',
    memory_enabled: 1,
    tools_enabled_json: JSON.stringify(['memory', 'chat', 'webhook_read']),
    permissions_json: defaultPermissionsJson(),
    workspace_id: 'default',
    temperature: null,
    max_output_tokens: null
  },
  {
    id: 'ra-agent-sentinel',
    name: 'Sentinel',
    role: 'Security & risk',
    description: 'Security review, permission gates, and risk detection.',
    color: '#FF4D5E',
    icon: 'shield',
    status: 'online',
    provider_id: 'ra-prov-ollama',
    model_name: 'llama3.2',
    system_prompt: 'You are Sentinel. Prioritize safety, data boundaries, and least privilege.',
    memory_enabled: 1,
    tools_enabled_json: JSON.stringify(['memory', 'chat', 'audit_log']),
    permissions_json: defaultPermissionsJson(),
    workspace_id: 'default',
    temperature: null,
    max_output_tokens: null
  }
]

const INSERT_P = `INSERT OR REPLACE INTO agent_provider_configs (
  id, name, type, endpoint_url, model_name, enabled, local_only, context_window, temperature, max_output_tokens,
  privacy_mode, default_chat, default_planning, default_coding, default_report, default_local_private, local_gguf_path, hf_import_url, created_at, updated_at
) VALUES (
  @id, @name, @type, @endpoint_url, @model_name, @enabled, @local_only, @context_window, @temperature, @max_output_tokens,
  @privacy_mode, @default_chat, @default_planning, @default_coding, @default_report, @default_local_private, @local_gguf_path, @hf_import_url, @created_at, @updated_at
)`

const INSERT_A = `INSERT OR REPLACE INTO resonant_agents (
  id, name, role, description, color, icon, status, provider_id, model_name, system_prompt, memory_enabled, tools_enabled_json, permissions_json, workspace_id, temperature, max_output_tokens, created_at, updated_at
) VALUES (
  @id, @name, @role, @description, @color, @icon, @status, @provider_id, @model_name, @system_prompt, @memory_enabled, @tools_enabled_json, @permissions_json, @workspace_id, @temperature, @max_output_tokens, @created_at, @updated_at
)`

export function raEnsureSeed(db: Database.Database): void {
  const n = db.prepare('SELECT COUNT(1) as c FROM agent_provider_configs').get() as { c: number }
  if (n.c === 0) {
    const st = db.prepare(INSERT_P)
    for (const p of DEFAULT_PROVIDERS) {
      st.run(p)
    }
  }
  const an = db.prepare('SELECT COUNT(1) as c FROM resonant_agents').get() as { c: number }
  if (an.c === 0) {
    const t = now()
    const st = db.prepare(INSERT_A)
    for (const a of DEFAULT_AGENTS) {
      st.run({ ...a, created_at: t, updated_at: t })
    }
  }
  const m = db.prepare("SELECT 1 FROM app_meta WHERE key = 'ra_local_only'").get()
  if (!m) {
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('ra_local_only', '0')").run()
  }
  const mm = db.prepare("SELECT 1 FROM app_meta WHERE key = 'ra_auto_listen'").get()
  if (!mm) {
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('ra_auto_listen', '1')").run()
  }
  const rd = db.prepare("SELECT 1 FROM app_meta WHERE key = 'ra_demo_mode'").get()
  if (!rd) {
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('ra_demo_mode', '0')").run()
  }
}

/** Enabled provider marked as default for chat, if any. */
export function raGetDefaultChatProvider(db: Database.Database): RaProviderRow | undefined {
  return db
    .prepare('SELECT * FROM agent_provider_configs WHERE default_chat = 1 AND enabled = 1 ORDER BY name LIMIT 1')
    .get() as RaProviderRow | undefined
}

/**
 * Resolves the provider to use: agent’s provider if present and enabled, else default chat provider.
 */
export function raResolveProviderForChat(
  db: Database.Database,
  agent: RaAgentRow
): { provider: RaProviderRow; usedFallback: boolean } | null {
  const direct = raGetProvider(db, agent.provider_id)
  if (direct && direct.enabled) {
    return { provider: direct, usedFallback: false }
  }
  const fallback = raGetDefaultChatProvider(db)
  if (fallback) {
    return { provider: fallback, usedFallback: true }
  }
  return null
}

export function raListProviders(db: Database.Database): RaProviderRow[] {
  return db.prepare('SELECT * FROM agent_provider_configs ORDER BY name ASC').all() as RaProviderRow[]
}

export function raGetProvider(db: Database.Database, id: string): RaProviderRow | undefined {
  return db.prepare('SELECT * FROM agent_provider_configs WHERE id = ?').get(id) as RaProviderRow | undefined
}

export function raUpsertProvider(db: Database.Database, r: RaProviderRow): void {
  db.prepare(INSERT_P).run(r)
}

export function raDeleteProvider(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM agent_provider_configs WHERE id = ?').run(id)
}

export function raListAgents(db: Database.Database): RaAgentRow[] {
  return db.prepare('SELECT * FROM resonant_agents ORDER BY name ASC').all() as RaAgentRow[]
}

export function raGetAgent(db: Database.Database, id: string): RaAgentRow | undefined {
  return db.prepare('SELECT * FROM resonant_agents WHERE id = ?').get(id) as RaAgentRow | undefined
}

export function raUpsertAgent(db: Database.Database, r: RaAgentRow): void {
  db.prepare(INSERT_A).run(r)
}

export function raDeleteAgent(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM resonant_agents WHERE id = ?').run(id)
}

export function raMetaGet(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function raMetaSet(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').run(key, value)
}

export function raListSessions(db: Database.Database): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM agent_sessions ORDER BY started_at DESC').all() as Array<Record<string, unknown>>
}

export function raGetSession(db: Database.Database, id: string): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function raUpsertSession(
  db: Database.Database,
  r: {
    id: string
    title: string
    active_agent_id: string
    mode: string
    signal_lock_score: number | null
    neural_link_status: string
    started_at: string
    ended_at: string | null
    summary: string | null
    title_locked: number
  }
): void {
  db.prepare(
    `INSERT OR REPLACE INTO agent_sessions (id, title, active_agent_id, mode, signal_lock_score, neural_link_status, started_at, ended_at, summary, title_locked)
     VALUES (@id, @title, @active_agent_id, @mode, @signal_lock_score, @neural_link_status, @started_at, @ended_at, @summary, @title_locked)`
  ).run(r)
}

export function raListMessages(db: Database.Database, sessionId: string): Array<Record<string, unknown>> {
  return db
    .prepare('SELECT * FROM agent_messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as Array<Record<string, unknown>>
}

export function raInsertMessage(
  db: Database.Database,
  r: {
    id: string
    session_id: string
    agent_id: string | null
    role: string
    input_source: string
    content: string
    tool_call_id: string | null
    created_at: string
    status?: string
    stream_id?: string | null
    error_text?: string | null
  }
): void {
  db.prepare(
    `INSERT INTO agent_messages (id, session_id, agent_id, role, input_source, content, tool_call_id, created_at, status, stream_id, error_text)
     VALUES (@id, @session_id, @agent_id, @role, @input_source, @content, @tool_call_id, @created_at, COALESCE(@status, 'complete'), @stream_id, @error_text)`
  ).run({
    ...r,
    status: r.status ?? null,
    stream_id: r.stream_id ?? null,
    error_text: r.error_text ?? null
  })
}

export function raUpdateMessage(
  db: Database.Database,
  r: {
    id: string
    content?: string
    status?: string
    stream_id?: string | null
    error_text?: string | null
  }
): void {
  const sets: string[] = []
  const row: Record<string, unknown> = { id: r.id }
  if (r.content !== undefined) {
    sets.push('content = @content')
    row['content'] = r.content
  }
  if (r.status !== undefined) {
    sets.push('status = @status')
    row['status'] = r.status
  }
  if (r.stream_id !== undefined) {
    sets.push('stream_id = @stream_id')
    row['stream_id'] = r.stream_id
  }
  if (r.error_text !== undefined) {
    sets.push('error_text = @error_text')
    row['error_text'] = r.error_text
  }
  if (sets.length === 0) {
    return
  }
  db.prepare(`UPDATE agent_messages SET ${sets.join(', ')} WHERE id = @id`).run(row)
}

export function raListMemory(db: Database.Database, agentId?: string): Array<Record<string, unknown>> {
  if (agentId) {
    return db
      .prepare('SELECT * FROM agent_memory WHERE agent_id = ? ORDER BY created_at DESC')
      .all(agentId) as Array<Record<string, unknown>>
  }
  return db.prepare('SELECT * FROM agent_memory ORDER BY created_at DESC').all() as Array<Record<string, unknown>>
}

export function raInsertMemory(
  db: Database.Database,
  r: {
    id: string
    agent_id: string
    session_id: string | null
    memory_type: string
    title: string
    body: string
    meta_json: string | null
    created_at: string
  }
): void {
  db.prepare(
    `INSERT OR REPLACE INTO agent_memory (id, agent_id, session_id, memory_type, title, body, meta_json, created_at)
     VALUES (@id, @agent_id, @session_id, @memory_type, @title, @body, @meta_json, @created_at)`
  ).run(r)
}

export function raListSwarms(db: Database.Database): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM agent_swarms ORDER BY created_at DESC').all() as Array<Record<string, unknown>>
}

export function raGetSwarm(db: Database.Database, id: string): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM agent_swarms WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function raUpsertSwarm(
  db: Database.Database,
  r: {
    id: string
    name: string
    description: string
    agents_json: string
    orchestration_mode: string
    leader_agent_id: string | null
    max_turns: number
    approval_required: number
    created_at: string
  }
): void {
  db.prepare(
    `INSERT OR REPLACE INTO agent_swarms (id, name, description, agents_json, orchestration_mode, leader_agent_id, max_turns, approval_required, created_at)
     VALUES (@id, @name, @description, @agents_json, @orchestration_mode, @leader_agent_id, @max_turns, @approval_required, @created_at)`
  ).run(r)
}

export function raDeleteSwarm(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM agent_swarms WHERE id = ?').run(id)
}

export function raInsertSwarmRun(
  db: Database.Database,
  r: {
    id: string
    swarm_id: string
    session_id: string | null
    status: string
    log_json: string | null
    started_at: string
    ended_at: string | null
  }
): void {
  db.prepare(
    `INSERT OR REPLACE INTO swarm_runs (id, swarm_id, session_id, status, log_json, started_at, ended_at)
     VALUES (@id, @swarm_id, @session_id, @status, @log_json, @started_at, @ended_at)`
  ).run(r)
}

export function raListThoughtCommands(db: Database.Database, sessionId: string): Array<Record<string, unknown>> {
  return db
    .prepare('SELECT * FROM thought_commands WHERE session_id = ? ORDER BY created_at DESC')
    .all(sessionId) as Array<Record<string, unknown>>
}

export function raUpsertThoughtCommand(
  db: Database.Database,
  r: {
    id: string
    session_id: string
    command: string
    confidence: number | null
    status: string
    source_metrics_json: string | null
    created_at: string
  }
): void {
  db.prepare(
    `INSERT OR REPLACE INTO thought_commands (id, session_id, command, confidence, status, source_metrics_json, created_at)
     VALUES (@id, @session_id, @command, @confidence, @status, @source_metrics_json, @created_at)`
  ).run(r)
}

export function raInsertToolApproval(
  db: Database.Database,
  r: { id: string; session_id: string; agent_id: string | null; tool_scope: string; action: string; details_json: string | null; created_at: string }
): void {
  db.prepare(
    `INSERT INTO tool_approval_events (id, session_id, agent_id, tool_scope, action, details_json, created_at)
     VALUES (@id, @session_id, @agent_id, @tool_scope, @action, @details_json, @created_at)`
  ).run(r)
}

export function raNewId(): string {
  return randomUUID()
}

export function raInsertInsightCalibrationSample(
  db: Database.Database,
  r: {
    id: string
    command_key: string
    calibration_run_id: string
    round_index: number
    phase: string
    sample_json: string
    created_at: string
  }
): void {
  db.prepare(
    `INSERT INTO insight_calibration_samples (id, command_key, calibration_run_id, round_index, phase, sample_json, created_at)
     VALUES (@id, @command_key, @calibration_run_id, @round_index, @phase, @sample_json, @created_at)`
  ).run(r)
}

export function raListInsightCalibrationSamples(
  db: Database.Database,
  commandKey?: string
): Array<Record<string, unknown>> {
  if (commandKey) {
    return db
      .prepare('SELECT * FROM insight_calibration_samples WHERE command_key = ? ORDER BY created_at DESC')
      .all(commandKey) as Array<Record<string, unknown>>
  }
  return db.prepare('SELECT * FROM insight_calibration_samples ORDER BY created_at DESC').all() as Array<
    Record<string, unknown>
  >
}

export function raEncyclopediaCount(db: Database.Database): number {
  const r = db.prepare('SELECT COUNT(1) as c FROM command_encyclopedia_entries').get() as { c: number }
  return r.c
}

export function raEncyclopediaUpsert(
  db: Database.Database,
  r: {
    id: string
    phrase: string
    aliases_json: string
    mode: string
    category: string
    intent: string
    target: string | null
    action_json: string
    risk_level: string
    requires_confirmation: number
    thought_patterns_json: string | null
    clarification_question: string | null
    enabled: number
    created_at: string
    updated_at: string
  }
): void {
  db.prepare(
    `INSERT OR REPLACE INTO command_encyclopedia_entries
     (id, phrase, aliases_json, mode, category, intent, target, action_json, risk_level, requires_confirmation, thought_patterns_json, clarification_question, enabled, created_at, updated_at)
     VALUES (@id, @phrase, @aliases_json, @mode, @category, @intent, @target, @action_json, @risk_level, @requires_confirmation, @thought_patterns_json, @clarification_question, @enabled, @created_at, @updated_at)`
  ).run(r)
}

export function raEncyclopediaList(db: Database.Database): Array<Record<string, unknown>> {
  return db
    .prepare('SELECT * FROM command_encyclopedia_entries ORDER BY category, phrase')
    .all() as Array<Record<string, unknown>>
}

export function raEncyclopediaSetEnabled(db: Database.Database, id: string, enabled: number): void {
  db.prepare('UPDATE command_encyclopedia_entries SET enabled = ?, updated_at = ? WHERE id = ?').run(
    enabled,
    new Date().toISOString(),
    id
  )
}

export function raInsertNeuralAlphabetEvent(
  db: Database.Database,
  r: { id: string; session_id: string | null; token_json: string; created_at: string }
): void {
  db.prepare(
    'INSERT INTO neural_alphabet_events (id, session_id, token_json, created_at) VALUES (?, ?, ?, ?)'
  ).run(r.id, r.session_id, r.token_json, r.created_at)
}

export function raInsertSentenceCandidateRow(
  db: Database.Database,
  r: { id: string; session_id: string | null; batch_id: string; candidate_json: string; created_at: string }
): void {
  db.prepare(
    'INSERT INTO sentence_candidates (id, session_id, batch_id, candidate_json, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(r.id, r.session_id, r.batch_id, r.candidate_json, r.created_at)
}

export function raInsertThoughtSelectionEvent(
  db: Database.Database,
  r: { id: string; session_id: string | null; event_type: string; payload_json: string | null; created_at: string }
): void {
  db.prepare(
    'INSERT INTO thought_selection_events (id, session_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(r.id, r.session_id, r.event_type, r.payload_json, r.created_at)
}

export function raInsertCommandExecutionEvent(
  db: Database.Database,
  r: {
    id: string
    command_entry_id: string
    source: string
    sentence: string
    action_type: string
    risk_level: string
    status: string
    approved: number
    output: string | null
    error: string | null
    created_at: string
    executed_at: string | null
  }
): void {
  db.prepare(
    `INSERT INTO command_execution_events
     (id, command_entry_id, source, sentence, action_type, risk_level, status, approved, output, error, created_at, executed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    r.id,
    r.command_entry_id,
    r.source,
    r.sentence,
    r.action_type,
    r.risk_level,
    r.status,
    r.approved,
    r.output,
    r.error,
    r.created_at,
    r.executed_at
  )
}
