import { useCallback, useEffect, useState } from 'react'
import { emotivCortex } from '@/services/EmotivCortexService'
import { localLLM } from '@/services/localLLM/LocalLLMService'
import { comfyUIService } from '@/services/ComfyUIService'

export type LocalServiceKey = 'llm' | 'comfy' | 'emotiv'

export type LocalServicesHealth = {
  llm: boolean | null
  comfy: boolean | null
  /** When ignoreEmotiv is true, this stays null (not probed). */
  emotiv: boolean | null
  errors: Partial<Record<LocalServiceKey, string>>
  /** True while user chose to skip EMOTIV checks (LLM+Comfy still work). */
  emotivNotPolled: boolean
  refresh: () => Promise<void>
}

/**
 * Probes local LLM and ComfyUI. EMOTIV is optional: when ignoreEmotiv is true, Cortex is not polled
 * and headset/EEG are expected to be unavailable until the user re-enables it.
 */
export function useLocalServicesHealth(ignoreEmotiv: boolean, pollMs = 22000): LocalServicesHealth {
  const [llm, setLlm] = useState<boolean | null>(null)
  const [comfy, setComfy] = useState<boolean | null>(null)
  const [emotiv, setEmotiv] = useState<boolean | null>(null)
  const [errors, setErrors] = useState<Partial<Record<LocalServiceKey, string>>>({})

  const refresh = useCallback(async () => {
    const nextErr: Partial<Record<LocalServiceKey, string>> = {}

    const [lr, cr] = await Promise.allSettled([localLLM.test(), comfyUIService.testConnection()])

    if (lr.status === 'fulfilled') {
      setLlm(lr.value.ok)
      if (!lr.value.ok) {
        nextErr.llm = lr.value.error ?? 'LLM unreachable'
      }
    } else {
      setLlm(false)
      nextErr.llm = (lr.reason as Error)?.message ?? 'LLM test failed'
    }

    if (cr.status === 'fulfilled') {
      setComfy(cr.value.ok)
      if (!cr.value.ok) {
        nextErr.comfy = cr.value.error ?? (cr.value as { detail?: string }).detail ?? 'ComfyUI unreachable'
      }
    } else {
      setComfy(false)
      nextErr.comfy = (cr.reason as Error)?.message ?? 'ComfyUI test failed'
    }

    if (ignoreEmotiv) {
      setEmotiv(null)
    } else {
      try {
        const er = await emotivCortex.testCortex()
        setEmotiv(er.ok)
        if (!er.ok) {
          nextErr.emotiv = er.error ?? 'Cortex unavailable'
        }
      } catch (e) {
        setEmotiv(false)
        nextErr.emotiv = (e as Error).message
      }
    }

    setErrors(nextErr)
  }, [ignoreEmotiv])

  useEffect(() => {
    void refresh()
    const t = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => window.clearInterval(t)
  }, [refresh, pollMs])

  return { llm, comfy, emotiv, errors, emotivNotPolled: ignoreEmotiv, refresh }
}

export function formatEmotivCortexMessage(raw: string | undefined): { friendly: string; isTls: boolean } {
  if (!raw) {
    return { friendly: 'Cortex is not available.', isTls: false }
  }
  const l = raw.toLowerCase()
  if (
    l.includes('certificate') ||
    l.includes('unable to verify') ||
    l.includes('cert_authority') ||
    l.includes('self signed') ||
    l.includes('ssl') ||
    l.includes('tls') ||
    l.includes('ephemeral')
  ) {
    return {
      isTls: true,
      friendly:
        'Cortex was found but the local certificate was not trusted by this environment. You can still test the local LLM and ComfyUI. Fix the cert for live headset data (EMOTIV docs / system trust store).'
    }
  }
  return { friendly: raw.length > 220 ? `${raw.slice(0, 220)}…` : raw, isTls: false }
}
