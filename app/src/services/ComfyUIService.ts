import { secureStorage } from './SecureStorageService'
import { DEFAULT_LOCAL_MODELS } from '@/types/rrvData'

const K = {
  comfy: 'comfy_endpoint',
  workflow: 'image_workflow',
  sdxl: 'comfy_sdxl_checkpoint',
  flux: 'comfy_flux_checkpoint',
  custom: 'comfy_custom_workflow_json'
}

function comfyBaseCandidates(baseUrl: string): string[] {
  const b = baseUrl.replace(/\/$/, '')
  const out = [b]
  try {
    const u = new URL(b.startsWith('http') ? b : `http://${b}`)
    const h = u.hostname
    if (h === 'localhost') {
      u.hostname = '127.0.0.1'
      out.push(u.toString().replace(/\/$/, ''))
    } else if (h === '127.0.0.1') {
      u.hostname = 'localhost'
      out.push(u.toString().replace(/\/$/, ''))
    }
  } catch {
    void 0
  }
  return [...new Set(out)]
}

/** Renderer-side Comfy health probe (no RRV IPC; Cerebral OS standalone). */
export async function testComfyConnectionRenderer(baseUrl: string): Promise<{
  ok: boolean
  error?: string
  detail?: string
}> {
  const errors: string[] = []
  for (const base of comfyBaseCandidates(baseUrl)) {
    for (const path of ['/system_stats', '/object_info', '/']) {
      try {
        const r = await fetch(`${base}${path}`, { method: 'GET' })
        if (r.ok) {
          return { ok: true, detail: `${base}${path}` }
        }
        errors.push(`${base}${path} HTTP ${r.status}`)
      } catch (e) {
        errors.push(`${base}${path}: ${(e as Error).message}`)
      }
    }
  }
  return { ok: false, error: errors.slice(0, 4).join(' · ') || 'ComfyUI unreachable' }
}

export async function loadComfyConfig(): Promise<{
  baseUrl: string
  imageWorkflow: 'flux-schnell' | 'sdxl' | 'custom'
  sdxlCheckpoint: string
  fluxCheckpoint: string
  customJson: string
}> {
  const a = await secureStorage.loadAll()
  return {
    baseUrl: a[K.comfy] ?? DEFAULT_LOCAL_MODELS.comfyEndpoint,
    imageWorkflow: (a[K.workflow] as 'flux-schnell' | 'sdxl' | 'custom') ?? DEFAULT_LOCAL_MODELS.imageWorkflow,
    sdxlCheckpoint: a[K.sdxl] ?? DEFAULT_LOCAL_MODELS.sdxlCheckpoint,
    fluxCheckpoint: a[K.flux] ?? DEFAULT_LOCAL_MODELS.fluxCheckpoint,
    customJson: a[K.custom] ?? ''
  }
}

export const comfyUIService = {
  async testConnection(): Promise<{ ok: boolean; error?: string; detail?: string }> {
    const c = await loadComfyConfig()
    return testComfyConnectionRenderer(c.baseUrl)
  }
}
