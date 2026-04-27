export type LocalChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface LocalLLMOptions {
  model?: string
  temperature?: number
  max_tokens?: number
}

export interface LocalLLMProvider {
  chat(messages: LocalChatMessage[], options?: LocalLLMOptions): Promise<string>
  testConnection(): Promise<boolean>
  listModels?(): Promise<string[]>
}
