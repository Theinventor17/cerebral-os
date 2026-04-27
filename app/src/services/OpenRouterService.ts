import { AgentProviderService } from './AgentProviderService'

export const OpenRouterService = {
  test(id: string) {
    return AgentProviderService.testConnection(id)
  }
}
