import type { LocalChatMessage, LocalLLMOptions, LocalLLMProvider } from './LocalLLMTypes'

/** Works with Ollama’s OpenAI bridge, llama.cpp server, vLLM, etc. */
export class OpenAICompatibleLocalProvider implements LocalLLMProvider {
  constructor(
    public endpoint: string,
    public defaultModel: string
  ) {}

  async chat(messages: LocalChatMessage[], options?: LocalLLMOptions): Promise<string> {
    return window.ra.llm.chat({
      url: this.endpoint,
      model: options?.model ?? this.defaultModel,
      messages: messages as Array<{ role: string; content: string }>,
      temperature: options?.temperature,
      max_tokens: options?.max_tokens
    })
  }

  async testConnection(): Promise<boolean> {
    const r = await window.ra.llm.test({ url: this.endpoint, model: this.defaultModel })
    return r.ok
  }
}
