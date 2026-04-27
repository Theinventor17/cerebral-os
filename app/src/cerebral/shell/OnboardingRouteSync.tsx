import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CEREBRAL_HEADSETS_TAB_ID } from '../headsetsTabConstants'
import { useCerebralLayout } from '../context/CerebralTabContext'

/**
 * Deep-link from welcome: #/cerebral/ide?headsets=1 or ?providers=1 or ?keys=1 (keys → providers)
 * Query is cleared after handling so the URL stays clean.
 */
export function OnboardingRouteSync(): null {
  const [searchParams, setSearchParams] = useSearchParams()
  const { setActivity, openTab } = useCerebralLayout()

  useEffect(() => {
    const h = searchParams.get('headsets')
    const p = searchParams.get('providers')
    const k = searchParams.get('keys')
    if (h !== '1' && p !== '1' && k !== '1') {
      return
    }
    if (h === '1') {
      setActivity('headsets')
      openTab({ id: CEREBRAL_HEADSETS_TAB_ID, title: 'Headsets', type: 'headsets', data: {} })
    } else {
      setActivity('providers')
    }
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, setActivity, openTab])

  return null
}
