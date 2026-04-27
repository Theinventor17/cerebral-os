export type CerebralActivityId =
  | 'explorer'
  | 'agents'
  | 'swarms'
  | 'skills'
  | 'providers'
  | 'memory'
  | 'headsets'
  | 'logs'
  | 'settings'

export type CerebralTabType =
  | 'agent_chat'
  | 'code'
  | 'browser'
  | 'swarm'
  | 'provider_config'
  | 'report'
  | 'memory'
  | 'logs'
  | 'headsets'
  | 'settings'

export type CerebralTab = {
  id: string
  title: string
  type: CerebralTabType
  icon?: string
  isDirty?: boolean
  data?: Record<string, unknown>
}

export type CerebralSkill = {
  id: string
  name: string
  description: string
  version?: string
  source: 'local' | 'github' | 'imported'
  skillPath?: string
  instructions: string
  tools?: string[]
  triggers?: string[]
  compatibleAgents?: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

