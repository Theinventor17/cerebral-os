import { AgentProviderService } from './AgentProviderService'

export const LMStudioService = {
  testSession(providerId: string) {
    return AgentProviderService.testConnection(providerId)
  }
}
