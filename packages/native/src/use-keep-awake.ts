import { useEffect } from 'react'
import { allowScreenSleep, keepScreenAwake } from './keep-awake'

/** Keeps the screen on while `active` is true and the component is mounted. */
export function useKeepAwake(active = true) {
  useEffect(() => {
    if (!active)
      return
    void keepScreenAwake()
    return () => {
      void allowScreenSleep()
    }
  }, [active])
}
