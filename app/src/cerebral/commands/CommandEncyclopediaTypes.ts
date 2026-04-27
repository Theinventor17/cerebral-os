export type CommandEncyclopediaMode = 'vibe' | 'imagine' | 'execute' | 'global'

export type CommandEncyclopediaCategory =
  | 'windows'
  | 'text_editing'
  | 'navigation'
  | 'browser'
  | 'media'
  | 'system'
  | 'accessibility'
  | 'app_launch'
  | 'agent'
  | 'creative'
  | 'terminal'
  | 'file'
  | 'workflow'

export type CommandAction =
  | { type: 'hotkey'; keys: string[] }
  | { type: 'keypress'; key: string; presses?: number }
  | { type: 'shell'; command: string }
  | { type: 'socket'; host: string; port: number; payload: string }
  | { type: 'internal'; handler: string }

export type CommandEncyclopediaEntry = {
  id: string
  phrase: string
  aliases: string[]
  mode: CommandEncyclopediaMode
  category: CommandEncyclopediaCategory
  intent: string
  target?: string
  action: CommandAction
  riskLevel: 'low' | 'medium' | 'high'
  requiresConfirmation: boolean
  thoughtPatterns?: string[]
  clarificationQuestion?: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export function commandActionPreview(a: CommandAction): string {
  switch (a.type) {
    case 'hotkey':
      return a.keys.join('+')
    case 'keypress':
      return a.presses && a.presses > 1 ? `${a.key} x${a.presses}` : a.key
    case 'shell':
      return a.command
    case 'socket':
      return `${a.host}:${a.port} ${a.payload}`
    case 'internal':
      return a.handler
    default:
      return '—'
  }
}
