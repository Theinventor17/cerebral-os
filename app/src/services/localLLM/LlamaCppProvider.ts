import { OpenAICompatibleLocalProvider } from './OpenAICompatibleLocalProvider'

/** llama.cpp --server with OpenAI-style chat completions, default http://127.0.0.1:8080/v1/... */
export class LlamaCppProvider extends OpenAICompatibleLocalProvider {}
