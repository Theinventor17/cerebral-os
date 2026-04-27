export type AgentStatus = 'online' | 'offline' | 'busy' | 'error'

export type AgentPermissionScope =
  | 'read_files'
  | 'write_files'
  | 'shell'
  | 'browser'
  | 'email'
  | 'calendar'
  | 'api_call'
  | 'webhook'
  | 'local_app'
  | 'memory_write'

export type AgentPermissionMode = 'disabled' | 'ask_each_time' | 'allowed'

export type AgentPermission = {
  id: string
  label: string
  scope: AgentPermissionScope
  mode: AgentPermissionMode
}

export type ProviderType =
  | 'ollama'
  | 'lmstudio'
  | 'llama_cpp'
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'custom_openai'
  | 'local_gguf'

export type ResonantAgent = {
  id: string
  name: string
  role: string
  description: string
  color: string
  icon: string
  status: AgentStatus
  providerId: string
  modelName: string
  /** When set, overrides provider defaults for chat completion. */
  temperature?: number
  /** When set, overrides provider defaults for chat completion. */
  maxOutputTokens?: number
  systemPrompt: string
  memoryEnabled: boolean
  toolsEnabled: string[]
  permissions: AgentPermission[]
  workspaceId: string
  createdAt: string
  updatedAt: string
}

export type ModelProviderConfig = {
  id: string
  name: string
  type: ProviderType
  endpointUrl: string
  apiKey?: string
  modelName: string
  enabled: boolean
  localOnly: boolean
  contextWindow?: number
  temperature?: number
  maxOutputTokens?: number
  privacyMode?: boolean
  defaultForChat: boolean
  defaultForPlanning: boolean
  defaultForCoding: boolean
  defaultForReportWriting: boolean
  defaultForLocalPrivate: boolean
  localGgufPath?: string
  hfImportUrl?: string
  createdAt: string
  updatedAt: string
}

export type SessionMode = 'manual' | 'thought' | 'hybrid'

/** Composer chat workflow — steers the model via an addendum to the system prompt. */
export type ComposerWorkflowMode = 'vibe' | 'imagine' | 'execute'

export type NeuralLinkStatus = 'connected' | 'disconnected' | 'ignored'

export type AgentSession = {
  id: string
  title: string
  /** If true, auto-title from the first user message is skipped. */
  titleLocked: boolean
  activeAgentId: string
  mode: SessionMode
  signalLockScore: number | null
  neuralLinkStatus: NeuralLinkStatus
  startedAt: string
  endedAt?: string
  summary?: string
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'
export type InputSource = 'manual' | 'thought' | 'voice' | 'system'

export type AgentMessageStatus = 'pending' | 'streaming' | 'complete' | 'failed' | 'cancelled'

export type AgentMessage = {
  id: string
  sessionId: string
  agentId?: string
  role: MessageRole
  inputSource: InputSource
  content: string
  createdAt: string
  toolCallId?: string
  /** Assistant message lifecycle for streaming and errors (defaults to complete when absent in DB). */
  status?: AgentMessageStatus
  streamId?: string
  errorText?: string
}

export type OrchestrationMode =
  | 'manual'
  | 'leader'
  | 'planner_executor'
  | 'debate'
  | 'review_board'
  | 'parallel'
  | 'sequential'

export type AgentSwarm = {
  id: string
  name: string
  description: string
  agents: string[]
  orchestrationMode: OrchestrationMode
  leaderAgentId?: string
  maxTurns: number
  approvalRequired: boolean
  createdAt: string
}

export type ThoughtCommandName =
  | 'focus_agent'
  | 'send_message'
  | 'ask_question'
  | 'request_output'
  | 'switch_agent'
  | 'confirm_intent'
  | 'reject_intent'
  | 'end_link'

export type ThoughtCommandStatus = 'idle' | 'detected' | 'confirmed' | 'rejected'

export type ThoughtCommand = {
  id: string
  sessionId: string
  command: ThoughtCommandName
  confidence: number | null
  status: ThoughtCommandStatus
  sourceMetrics?: Record<string, unknown>
  createdAt: string
}

export type MemoryEntryType = 'conversation' | 'goal_set' | 'image_output' | 'insight' | 'note'

export type AgentMemoryEntry = {
  id: string
  agentId: string
  sessionId?: string
  memoryType: MemoryEntryType
  title: string
  body: string
  createdAt: string
}
