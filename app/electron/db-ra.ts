import Database from 'better-sqlite3'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { app } from 'electron'
import { raEnsureSeed } from './ra-db'

/** Cerebral OS standalone app DB (schema aligned with the former RRV resonant block). */
function applyResonantMigrations(db: Database.Database): void {
  const cols = db.prepare('PRAGMA table_info(resonant_agents)').all() as { name: string }[]
  const names = new Set(cols.map((c) => c.name))
  if (!names.has('temperature')) {
    db.exec('ALTER TABLE resonant_agents ADD COLUMN temperature REAL')
  }
  if (!names.has('max_output_tokens')) {
    db.exec('ALTER TABLE resonant_agents ADD COLUMN max_output_tokens INTEGER')
  }
}

const CEREBRAL_PLATFORM_SCHEMA = `
CREATE TABLE IF NOT EXISTS cerbral_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cerbral_tabs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  data_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_dirty INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cerbral_tabs_ws ON cerbral_tabs(workspace_id, sort_order);

CREATE TABLE IF NOT EXISTS tool_approval_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  agent_id TEXT,
  tool TEXT NOT NULL,
  command_text TEXT NOT NULL,
  reason TEXT,
  risk_level TEXT NOT NULL,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tool_approval_status ON tool_approval_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS terminal_executions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  cwd TEXT NOT NULL,
  command_line TEXT NOT NULL,
  source TEXT NOT NULL,
  approval_request_id TEXT,
  status TEXT NOT NULL,
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_term_exec_time ON terminal_executions(started_at DESC);

CREATE TABLE IF NOT EXISTS provider_logs (
  id TEXT PRIMARY KEY,
  provider_id TEXT,
  model_name TEXT,
  agent_id TEXT,
  success INTEGER NOT NULL,
  error_message TEXT,
  request_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_logs_time ON provider_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS cerbral_skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  version TEXT,
  source TEXT NOT NULL,
  skill_path TEXT,
  instructions TEXT NOT NULL,
  tools_json TEXT,
  triggers_json TEXT,
  compatible_agents_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_skill_links (
  agent_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  PRIMARY KEY (agent_id, skill_id)
);

CREATE TABLE IF NOT EXISTS cerbral_gguf_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  runtime TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insight_calibration_samples (
  id TEXT PRIMARY KEY,
  command_key TEXT NOT NULL,
  calibration_run_id TEXT NOT NULL,
  round_index INTEGER NOT NULL,
  phase TEXT NOT NULL,
  sample_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insight_cal_run ON insight_calibration_samples(calibration_run_id, round_index);

CREATE TABLE IF NOT EXISTS command_encyclopedia_entries (
  id TEXT PRIMARY KEY,
  phrase TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  mode TEXT NOT NULL,
  category TEXT NOT NULL,
  intent TEXT NOT NULL,
  target TEXT,
  action_json TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  requires_confirmation INTEGER NOT NULL,
  thought_patterns_json TEXT,
  clarification_question TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_encyclopedia_phrase ON command_encyclopedia_entries(phrase);

CREATE TABLE IF NOT EXISTS neural_alphabet_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  token_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_neural_events_t ON neural_alphabet_events(created_at DESC);

CREATE TABLE IF NOT EXISTS sentence_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  batch_id TEXT NOT NULL,
  candidate_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sentence_batch ON sentence_candidates(session_id, batch_id);

CREATE TABLE IF NOT EXISTS thought_selection_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thought_sel_t ON thought_selection_events(created_at DESC);

CREATE TABLE IF NOT EXISTS command_execution_events (
  id TEXT PRIMARY KEY,
  command_entry_id TEXT NOT NULL,
  source TEXT NOT NULL,
  sentence TEXT NOT NULL,
  action_type TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT NOT NULL,
  approved INTEGER NOT NULL,
  output TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  executed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cmd_exec_t ON command_execution_events(created_at DESC);
`

function applyCerebralPlatformMigrations(db: Database.Database, userHome: string): void {
  db.exec(CEREBRAL_PLATFORM_SCHEMA)
  const memCols = db.prepare('PRAGMA table_info(agent_memory)').all() as { name: string }[]
  if (!new Set(memCols.map((c) => c.name)).has('source')) {
    db.exec("ALTER TABLE agent_memory ADD COLUMN source TEXT NOT NULL DEFAULT 'agent'")
  }
  const defaultPath = join(userHome, 'CerebralOS', 'workspaces', 'default')
  const n = db.prepare("SELECT 1 FROM cerbral_workspaces WHERE id = 'default'").get()
  if (!n) {
    db.prepare(
      'INSERT OR REPLACE INTO cerbral_workspaces (id, name, root_path, created_at) VALUES (?, ?, ?, ?)'
    ).run('default', 'default', defaultPath, new Date().toISOString())
  }
  const sessCols = db.prepare('PRAGMA table_info(agent_sessions)').all() as { name: string }[]
  if (!new Set(sessCols.map((c) => c.name)).has('title_locked')) {
    db.exec('ALTER TABLE agent_sessions ADD COLUMN title_locked INTEGER NOT NULL DEFAULT 0')
  }
  const amCols = db.prepare('PRAGMA table_info(agent_messages)').all() as { name: string }[]
  const amNames = new Set(amCols.map((c) => c.name))
  if (!amNames.has('status')) {
    db.exec("ALTER TABLE agent_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'")
  }
  if (!amNames.has('stream_id')) {
    db.exec('ALTER TABLE agent_messages ADD COLUMN stream_id TEXT')
  }
  if (!amNames.has('error_text')) {
    db.exec('ALTER TABLE agent_messages ADD COLUMN error_text TEXT')
  }
}

const RESONANT_SCHEMA = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS agent_provider_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  model_name TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  local_only INTEGER NOT NULL DEFAULT 0,
  context_window INTEGER,
  temperature REAL,
  max_output_tokens INTEGER,
  privacy_mode INTEGER,
  default_chat INTEGER NOT NULL DEFAULT 0,
  default_planning INTEGER NOT NULL DEFAULT 0,
  default_coding INTEGER NOT NULL DEFAULT 0,
  default_report INTEGER NOT NULL DEFAULT 0,
  default_local_private INTEGER NOT NULL DEFAULT 0,
  local_gguf_path TEXT,
  hf_import_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resonant_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO resonant_workspaces (id, name, created_at) VALUES ('default', 'Default Workspace', datetime('now'));

CREATE TABLE IF NOT EXISTS resonant_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  memory_enabled INTEGER NOT NULL,
  tools_enabled_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resonant_agents_workspace ON resonant_agents(workspace_id);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  active_agent_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  signal_lock_score REAL,
  neural_link_status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  summary TEXT,
  title_locked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_started ON agent_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT,
  role TEXT NOT NULL,
  input_source TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_call_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS agent_memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT,
  memory_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON agent_memory(session_id);

CREATE TABLE IF NOT EXISTS thought_commands (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  command TEXT NOT NULL,
  confidence REAL,
  status TEXT NOT NULL,
  source_metrics_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thought_session ON thought_commands(session_id);

CREATE TABLE IF NOT EXISTS agent_swarms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  agents_json TEXT NOT NULL,
  orchestration_mode TEXT NOT NULL,
  leader_agent_id TEXT,
  max_turns INTEGER NOT NULL,
  approval_required INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS swarm_runs (
  id TEXT PRIMARY KEY,
  swarm_id TEXT NOT NULL,
  session_id TEXT,
  status TEXT NOT NULL,
  log_json TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_permissions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  label TEXT NOT NULL,
  scope TEXT NOT NULL,
  mode TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_perms_agent ON agent_permissions(agent_id);

CREATE TABLE IF NOT EXISTS tool_approval_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT,
  tool_scope TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_approval_session ON tool_approval_events(session_id);
`

export function openResonantDatabase(): { path: string; db: Database.Database } {
  const userData = app.getPath('userData')
  const dbPath = join(userData, 'cerbral_os.sqlite3')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(RESONANT_SCHEMA)
  applyResonantMigrations(db)
  applyCerebralPlatformMigrations(db, homedir())
  raEnsureSeed(db)
  return { path: dbPath, db }
}
