import type { HeadsetAdapter, HeadsetDeviceProfile } from './HeadsetAdapter'
import { EmotivInsightAdapter, EMOTIV_INSIGHT_PROFILE } from './EmotivInsightAdapter'

const byId = new Map<string, HeadsetAdapter>()

byId.set(EMOTIV_INSIGHT_PROFILE.id, EmotivInsightAdapter)

export const HeadsetRegistry = {
  list(): HeadsetDeviceProfile[] {
    return [EMOTIV_INSIGHT_PROFILE]
  },
  get(id: string): HeadsetAdapter | null {
    return byId.get(id) ?? null
  },
  has(id: string): boolean {
    return byId.has(id)
  }
}
