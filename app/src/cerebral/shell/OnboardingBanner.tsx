import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { CEREBRAL_HEADSETS_TAB_ID } from '../headsetsTabConstants'
import { dismissIdeOnboardingStrip, isIdeOnboardingStripVisible } from '../onboarding/onboardingStorage'
import { useCerebralLayout } from '../context/CerebralTabContext'

/**
 * One-time strip: point users to Providers + optional Headsets (◎) after they reach the IDE.
 */
export function OnboardingBanner(): ReactNode {
  const [open, setOpen] = useState(() => isIdeOnboardingStripVisible())
  const { setActivity, openTab } = useCerebralLayout()

  const dismiss = useCallback(() => {
    dismissIdeOnboardingStrip()
    setOpen(false)
  }, [])

  const goProviders = useCallback(() => {
    setActivity('providers')
  }, [setActivity])

  const goHeadsets = useCallback(() => {
    setActivity('headsets')
    openTab({ id: CEREBRAL_HEADSETS_TAB_ID, title: 'Headsets', type: 'headsets', data: {} })
  }, [setActivity, openTab])

  if (!open) {
    return null
  }

  return (
    <div className="cos-onboard" role="region" aria-label="Getting started">
      <div className="cos-onboard-inner">
        <p className="cos-onboard-text">
          <strong>Finish setup:</strong> open <span className="cos-onboard-kb">◫ Providers</span> for models and API keys (one
          form per provider—no separate keys screen). Neural control is <strong>optional</strong> —{' '}
          <span className="cos-onboard-kb" title="Headsets activity">
            ◎ Headsets
          </span>{' '}
          for EMOTIV / Cortex.
        </p>
        <div className="cos-onboard-actions">
          <button type="button" className="cos-onboard-btn" onClick={goProviders}>
            Open Providers
          </button>
          <button type="button" className="cos-onboard-btn cos-onboard-btn--ghost" onClick={goHeadsets}>
            ◎ Headsets
          </button>
          <button type="button" className="cos-onboard-dismiss" onClick={dismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
