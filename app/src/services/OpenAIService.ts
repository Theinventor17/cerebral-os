import { AgentProviderService } from './AgentProviderService'

export const OpenAIService = {
  test(id: string) {
    return AgentProviderService.testConnection(id)
  }
}
