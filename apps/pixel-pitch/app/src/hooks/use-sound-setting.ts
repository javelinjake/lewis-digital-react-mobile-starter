import { useSyncExternalStore } from 'react'
import { setSoundOn, soundOn, subscribeSound } from '@/lib/sound/sound'

/** Sound on or off, kept on this device. */
export function useSoundSetting(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeSound, soundOn, () => true)
  return [on, setSoundOn]
}
