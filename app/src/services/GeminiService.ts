import { AgentProviderService } from './AgentProviderService'

export const GeminiService = {
  test(id: string) {
    return AgentProviderService.testConnection(id)
  }
}
