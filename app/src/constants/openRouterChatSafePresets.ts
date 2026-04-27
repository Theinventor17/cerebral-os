/** Chat/instruct models that tend to stream normal assistant text on OpenRouter. Keep in sync with `OPENROUTER_CHAT_SAFE_PRESETS` in `electron/ra-llm-providers.ts`. */
export const OPENROUTER_CHAT_SAFE_PRESETS: string[] = [
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
  'meta-llama/llama-3.1-8b-instruct',
  'mistralai/mistral-7b-instruct',
  'qwen/qwen-2.5-7b-instruct',
  'google/gemini-flash-1.5'
]
