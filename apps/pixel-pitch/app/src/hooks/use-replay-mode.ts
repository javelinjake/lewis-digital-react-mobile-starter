import { useCallback, useSyncExternalStore } from 'react'

export type ReplayMode = 'text' | 'pitch'

const KEY = 'pp-replay-mode'
const listeners = new Set<() => void>()

function read(): ReplayMode {
  try {
    return localStorage.getItem(KEY) === 'pitch' ? 'pitch' : 'text'
  }
  catch {
    return 'text'
  }
}

/** How the player likes to watch a match: a text report (the default) or the pixel pitch. Remembered on this device. */
export function useReplayMode(): [ReplayMode, (mode: ReplayMode) => void] {
  const mode = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => 'text' as const,
  )
  const set = useCallback((next: ReplayMode) => {
    try {
      localStorage.setItem(KEY, next)
    }
    catch {
      // Private browsing: the choice lasts until the page closes.
    }
    for (const listener of listeners)
      listener()
  }, [])
  return [mode, set]
}
