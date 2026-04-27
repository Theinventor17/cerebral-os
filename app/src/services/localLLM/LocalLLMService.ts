import { secureStorage } from '../SecureStorageService'
import { OpenAICompatibleLocalProvider } from './OpenAICompatibleLocalProvider'
import type { LocalChatMessage, LocalLLMOptions } from './LocalLLMTypes'
import { DEFAULT_LOCAL_MODELS, type LlmRuntime } from '@/types/rrvData'

const KEYS = {
  runtime: 'local_llm_runtime',
  endpoint: 'local_llm_endpoint',
  model: 'local_llm_model',
  reportModel: 'local_report_model',
  fallback: 'local_llm_fallback_model'
} as const

export async function loadLocalLLMConfig(): Promise<{
  runtime: LlmRuntime
  endpoint: string
  model: string
  reportModel: string
  fallback: string
}> {
  const a = await secureStorage.loadAll()
  return {
    runtime: (a[KEYS.runtime] as LlmRuntime) ?? DEFAULT_LOCAL_MODELS.llmRuntime,
    endpoint: a[KEYS.endpoint] ?? DEFAULT_LOCAL_MODELS.llmEndpoint,
    model: a[KEYS.model] ?? DEFAULT_LOCAL_MODELS.llmModel,
    reportModel: a[KEYS.reportModel] ?? DEFAULT_LOCAL_MODELS.reportModel,
    fallback: a[KEYS.fallback] ?? DEFAULT_LOCAL_MODELS.llmFallbackModel
  }
}

export const localLLM = {
  async chat(messages: LocalChatMessage[], options?: LocalLLMOptions & { useReportModel?: boolean; modelOverride?: string }): Promise<string> {
    const cfg = await loadLocalLLMConfig()
    const model = options?.modelOverride ?? (options?.useReportModel ? cfg.reportModel : cfg.model)
    const p = new OpenAICompatibleLocalProvider(cfg.endpoint, model)
    return p.chat(messages, { ...options, model })
  },

  async chatWithFallback(
    messages: LocalChatMessage[],
    options?: LocalLLMOptions & { useReportModel?: boolean; modelOverride?: string }
  ): Promise<string> {
    const cfg = await loadLocalLLMConfig()
    try {
      return await this.chat(messages, { ...options, modelOverride: options?.modelOverride ?? (options?.useReportModel ? cfg.reportModel : cfg.model) })
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('404') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('load')) {
        return this.chat(messages, { ...options, modelOverride: cfg.fallback, useReportModel: false })
      }
      throw e
    }
  },

  async test(): Promise<{ ok: boolean; error?: string; sample?: string }> {
    const cfg = await loadLocalLLMConfig()
    return window.ra.llm.test({ url: cfg.endpoint, model: cfg.model })
  }
}
