import type { GameResponse } from '@ld/pixel-pitch-core'
import { useMemo, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  timer ??= setInterval(() => listeners.forEach(notify => notify()), 1000)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** The device's clock, to the second. */
const deviceSecond = () => Math.floor(Date.now() / 1000) * 1000

/**
 * The server's idea of now, ticking every second, so piles and countdowns follow the server's clock and not a phone
 * with the wrong time. Measured from when the game's last answer arrived.
 */
export function useServerNow(game: GameResponse) {
  const offset = useMemo(() => game.now - Date.now(), [game])
  return useSyncExternalStore(subscribe, deviceSecond, deviceSecond) + offset
}
