import { OpenAICompatibleLocalProvider } from './OpenAICompatibleLocalProvider'

/** Ollama uses the same OpenAI-compatible /v1/chat/completions when enabled. */
export class OllamaProvider extends OpenAICompatibleLocalProvider {}
