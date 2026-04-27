import type { AgentMemoryEntry, MemoryEntryType } from '../types'
import { newId } from './mappers'

function ra() {
  return window.ra
}

export const AgentMemoryService = {
  async list(agentId?: string): Promise<AgentMemoryEntry[]> {
    const rows = (await ra().memory.list(agentId)) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: String(r.id),
      agentId: String(r.agent_id),
      sessionId: r.session_id == null ? undefined : String(r.session_id),
      memoryType: String(r.memory_type) as MemoryEntryType,
      title: String(r.title),
      body: String(r.body),
      createdAt: String(r.created_at)
    }))
  },

  async add(e: {
    agentId: string
    sessionId?: string
    memoryType: MemoryEntryType
    title: string
    body: string
    meta?: Record<string, unknown>
  }): Promise<string> {
    const id = newId()
    const now = new Date().toISOString()
    await ra().memory.insert({
      id,
      agent_id: e.agentId,
      session_id: e.sessionId ?? null,
      memory_type: e.memoryType,
      title: e.title,
      body: e.body,
      meta_json: e.meta ? JSON.stringify(e.meta) : null,
      created_at: now
    })
    return id
  }
}
