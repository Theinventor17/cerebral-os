import { AgentProviderService } from './AgentProviderService'

export const ClaudeService = {
  test(id: string) {
    return AgentProviderService.testConnection(id)
  }
}
