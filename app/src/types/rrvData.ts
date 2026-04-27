export type ImageModelName = 'flux-schnell' | 'sdxl' | 'custom'

export type SessionGeneratedImage = {
  id: string
  sessionId: string
  generationNumber: number
  imagePath: string
  imageUrl: string
  prompt: string
  negativePrompt?: string
  createdAt: string
  signalLockScore: number | null
  clarityScore: number | null
  phaseLabel: string
  imageModel: ImageModelName
  status: 'generating' | 'complete' | 'failed'
  aiDescription?: string
  visualTags?: string[]
  error?: string
}

export type SignalLanguageFrame = {
  id: string
  sessionId: string
  createdAt: string
  signalSummary: string
  naturalLanguageDescription: string
  extractedVisualTags: string[]
  imagePrompt: string
  negativePrompt: string
  confidence: number
  uncertaintyNotes: string[]
  sourceMetrics: Record<string, unknown>
  modelUsed: string
}

export type ChatMessage = {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  linkedImageId?: string
}

export type SessionReport = {
  id: string
  sessionId: string
  createdAt: string
  markdown: string
  modelUsed: string
}

export type LlmRuntime = 'ollama' | 'llamacpp' | 'openai-compatible'

export type LLMOutJSON = {
  signalSummary: string
  naturalLanguageDescription: string
  extractedVisualTags: string[]
  imagePrompt: string
  negativePrompt: string
  confidence: number
  uncertaintyNotes: string[]
}

export type CockpitChips = {
  sessionId: string
  targetId: string
  targetMode: string
  phase: string
  signalLockPct: number
  phaseClass?: 'warn' | 'ok' | 'bad'
}

export type LocalModelSettings = {
  llmRuntime: LlmRuntime
  llmEndpoint: string
  llmModel: string
  reportModel: string
  llmFallbackModel: string
  comfyEndpoint: string
  imageWorkflow: 'flux-schnell' | 'sdxl' | 'custom'
  sdxlCheckpoint: string
  fluxCheckpoint: string
  customComfyJson: string
}

export const DEFAULT_LOCAL_MODELS: LocalModelSettings = {
  llmRuntime: 'ollama',
  llmEndpoint: 'http://localhost:11434/v1/chat/completions',
  llmModel: 'qwen3:14b',
  reportModel: 'deepseek-r1:14b',
  llmFallbackModel: 'llama3.1:8b',
  comfyEndpoint: 'http://127.0.0.1:8188',
  imageWorkflow: 'flux-schnell',
  sdxlCheckpoint: 'sd_xl_base_1.0.safetensors',
  fluxCheckpoint: 'FLUX.1-schnell-fp8.safetensors',
  customComfyJson: ''
}
