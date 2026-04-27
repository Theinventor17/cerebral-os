import type { AgentMessage, ModelProviderConfig, ResonantAgent, ThoughtCommandName, ThoughtCommandStatus } from '../types'
import type { AgentPermission, AgentStatus, InputSource, MessageRole, NeuralLinkStatus, ProviderType, SessionMode } from '../types'
import { v4 as uuidv4 } from 'uuid'

export function rowToProvider(r: Record<string, unknown>): ModelProviderConfig {
  return {
    id: String(r.id),
    name: String(r.name),
    type: r.type as ProviderType,
    endpointUrl: String(r.endpoint_url),
    modelName: String(r.model_name),
    enabled: Number(r.enabled) === 1,
    localOnly: Number(r.local_only) === 1,
    contextWindow: r.context_window == null ? undefined : Number(r.context_window),
    temperature: r.temperature == null ? undefined : Number(r.temperature),
    maxOutputTokens: r.max_output_tokens == null ? undefined : Number(r.max_output_tokens),
    privacyMode: r.privacy_mode == null ? undefined : Number(r.privacy_mode) === 1,
    defaultForChat: Number(r.default_chat) === 1,
    defaultForPlanning: Number(r.default_planning) === 1,
    defaultForCoding: Number(r.default_coding) === 1,
    defaultForReportWriting: Number(r.default_report) === 1,
    defaultForLocalPrivate: Number(r.default_local_private) === 1,
    localGgufPath: r.local_gguf_path == null || r.local_gguf_path === '' ? undefined : String(r.local_gguf_path),
    hfImportUrl: r.hf_import_url == null || r.hf_import_url === '' ? undefined : String(r.hf_import_url),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at)
  }
}

export function providerToRow(
  c: ModelProviderConfig,
  apiKeyTouched: boolean
): Record<string, string | number | null | undefined> {
  const base: Record<string, string | number | null | undefined> = {
    id: c.id,
    name: c.name,
    type: c.type,
    endpoint_url: c.endpointUrl,
    model_name: c.modelName,
    enabled: c.enabled ? 1 : 0,
    local_only: c.localOnly ? 1 : 0,
    context_window: c.contextWindow ?? null,
    temperature: c.temperature ?? null,
    max_output_tokens: c.maxOutputTokens ?? null,
    privacy_mode: c.privacyMode == null ? null : c.privacyMode ? 1 : 0,
    default_chat: c.defaultForChat ? 1 : 0,
    default_planning: c.defaultForPlanning ? 1 : 0,
    default_coding: c.defaultForCoding ? 1 : 0,
    default_report: c.defaultForReportWriting ? 1 : 0,
    default_local_private: c.defaultForLocalPrivate ? 1 : 0,
    local_gguf_path: c.localGgufPath ?? null,
    hf_import_url: c.hfImportUrl ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt
  }
  if (apiKeyTouched) {
    base.apiKey = c.apiKey ?? ''
  }
  return base
}

export function rowToAgent(r: Record<string, unknown>): ResonantAgent {
  const perms = JSON.parse(String(r.permissions_json)) as AgentPermission[]
  return {
    id: String(r.id),
    name: String(r.name),
    role: String(r.role),
    description: String(r.description),
    color: String(r.color),
    icon: String(r.icon),
    status: r.status as AgentStatus,
    providerId: String(r.provider_id),
    modelName: String(r.model_name),
    temperature: r.temperature == null || r.temperature === '' ? undefined : Number(r.temperature),
    maxOutputTokens:
      r.max_output_tokens == null || r.max_output_tokens === '' ? undefined : Number(r.max_output_tokens),
    systemPrompt: String(r.system_prompt),
    memoryEnabled: Number(r.memory_enabled) === 1,
    toolsEnabled: JSON.parse(String(r.tools_enabled_json)) as string[],
    permissions: perms,
    workspaceId: String(r.workspace_id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at)
  }
}

export function agentToRow(a: ResonantAgent): Record<string, string | number | null> {
  return {
    id: a.id,
    name: a.name,
    role: a.role,
    description: a.description,
    color: a.color,
    icon: a.icon,
    status: a.status,
    provider_id: a.providerId,
    model_name: a.modelName,
    temperature: a.temperature ?? null,
    max_output_tokens: a.maxOutputTokens ?? null,
    system_prompt: a.systemPrompt,
    memory_enabled: a.memoryEnabled ? 1 : 0,
    tools_enabled_json: JSON.stringify(a.toolsEnabled),
    permissions_json: JSON.stringify(a.permissions),
    workspace_id: a.workspaceId,
    created_at: a.createdAt,
    updated_at: a.updatedAt
  }
}

export function rowToMessage(r: Record<string, unknown>): AgentMessage {
  const rawStatus = r.status == null || r.status === '' ? undefined : String(r.status)
  const st = rawStatus as AgentMessage['status'] | undefined
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    agentId: r.agent_id == null ? undefined : String(r.agent_id),
    role: r.role as MessageRole,
    inputSource: r.input_source as InputSource,
    content: String(r.content),
    createdAt: String(r.created_at),
    toolCallId: r.tool_call_id == null ? undefined : String(r.tool_call_id),
    status: (st === 'pending' ||
    st === 'streaming' ||
    st === 'complete' ||
    st === 'failed' ||
    st === 'cancelled'
      ? st
      : undefined) as AgentMessage['status'] | undefined,
    streamId: r.stream_id == null || r.stream_id === '' ? undefined : String(r.stream_id),
    errorText: r.error_text == null || r.error_text === '' ? undefined : String(r.error_text)
  }
}

export function rowToSession(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    title: String(r.title),
    titleLocked: r.title_locked != null && Number(r.title_locked) === 1,
    activeAgentId: String(r.active_agent_id),
    mode: r.mode as SessionMode,
    signalLockScore: r.signal_lock_score == null ? null : Number(r.signal_lock_score),
    neuralLinkStatus: r.neural_link_status as NeuralLinkStatus,
    startedAt: String(r.started_at),
    endedAt: r.ended_at == null ? undefined : String(r.ended_at),
    summary: r.summary == null ? undefined : String(r.summary)
  }
}

export function rowToThought(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    command: r.command as ThoughtCommandName,
    confidence: r.confidence == null ? null : Number(r.confidence),
    status: r.status as ThoughtCommandStatus,
    sourceMetrics: r.source_metrics_json ? (JSON.parse(String(r.source_metrics_json)) as Record<string, unknown>) : undefined,
    createdAt: String(r.created_at)
  }
}

export function newId(): string {
  return uuidv4()
}
