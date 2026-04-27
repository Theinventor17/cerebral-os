import type { ModelProviderConfig } from '../types'
import { newId, providerToRow, rowToProvider } from './mappers'

function ra() {
  return window.ra
}

export const AgentProviderService = {
  async list(): Promise<ModelProviderConfig[]> {
    const rows = (await ra().provider.list()) as Array<Record<string, unknown>>
    return rows.map(rowToProvider)
  },

  async get(id: string): Promise<ModelProviderConfig | null> {
    const r = (await ra().provider.get(id)) as Record<string, unknown> | null
    if (!r) {
      return null
    }
    return rowToProvider(r)
  },

  async hasStoredKey(id: string): Promise<boolean> {
    return ra().provider.hasKey(id)
  },

  async save(c: ModelProviderConfig, options?: { apiKeyTouched?: boolean }): Promise<void> {
    const apiKeyTouched = options?.apiKeyTouched === true
    await ra().provider.upsert(providerToRow(c, apiKeyTouched) as never)
  },

  async create(
    partial: Partial<ModelProviderConfig> & { name: string; type: ModelProviderConfig['type'] }
  ): Promise<ModelProviderConfig> {
    const t = new Date().toISOString()
    const id = partial.id ?? newId()
    const p: ModelProviderConfig = {
      id,
      name: partial.name,
      type: partial.type,
      endpointUrl: partial.endpointUrl ?? 'http://localhost:11434/v1/chat/completions',
      modelName: partial.modelName ?? 'llama3.2',
      enabled: partial.enabled ?? true,
      localOnly: partial.localOnly ?? false,
      contextWindow: partial.contextWindow,
      temperature: partial.temperature,
      maxOutputTokens: partial.maxOutputTokens,
      privacyMode: partial.privacyMode,
      defaultForChat: partial.defaultForChat ?? false,
      defaultForPlanning: partial.defaultForPlanning ?? false,
      defaultForCoding: partial.defaultForCoding ?? false,
      defaultForReportWriting: partial.defaultForReportWriting ?? false,
      defaultForLocalPrivate: partial.defaultForLocalPrivate ?? false,
      localGgufPath: partial.localGgufPath,
      hfImportUrl: partial.hfImportUrl,
      createdAt: partial.createdAt ?? t,
      updatedAt: t,
      apiKey: partial.apiKey
    }
    await this.save(p, { apiKeyTouched: !!partial.apiKey })
    return p
  },

  async remove(id: string): Promise<void> {
    await ra().provider.delete(id)
  },

  async testConnection(providerId: string) {
    return ra().provider.test(providerId)
  },

  async listModels(providerId: string) {
    return ra().provider.models(providerId) as Promise<{
      ok: boolean
      error?: string
      defaultModel: string
      models: Array<{ id: string; name: string }>
    }>
  }
}
