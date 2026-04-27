const KEY = 'cerebral.onboarding.v1'

type V1 = {
  /** User dismissed the IDE "finish setup" strip. */
  ideStripDismissed?: boolean
}

function read(): V1 {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return {}
    }
    return JSON.parse(raw) as V1
  } catch {
    return {}
  }
}

function write(p: V1): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...p }))
  } catch {
    // ignore
  }
}

export function isIdeOnboardingStripVisible(): boolean {
  return !read().ideStripDismissed
}

export function dismissIdeOnboardingStrip(): void {
  write({ ideStripDismissed: true })
}
