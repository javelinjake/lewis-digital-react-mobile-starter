/** Times are epoch milliseconds from the SERVER clock. The client never supplies one. */
export interface IdleState {
  /** Packs waiting on the shelf. */
  shelfPacks: number
  /** When the next pack's timer started. While the shelf is full the clock idles and is reset when a pack is taken. */
  shelfClockAt: number
  /** Coins in the stadium were last collected at this time; the pile since is derived, never stored. */
  stadiumCollectedAt: number
  stadiumLevel: number
  /** Token trays, one per cabinet, last emptied at. */
  trayCollectedAt: { kick: number, keepy: number }
  /** Which day (see `dayIndex`) gems were last granted for. */
  gemsGrantedForDay: number
  gems: number
  hasPass: boolean
}

export function newIdleState(now: number): IdleState {
  return {
    shelfPacks: 0,
    shelfClockAt: now,
    stadiumCollectedAt: now,
    stadiumLevel: 1,
    trayCollectedAt: { kick: now, keepy: now },
    gemsGrantedForDay: -1,
    gems: 0,
    hasPass: false,
  }
}

export type WelcomeBackEvent =
  | { type: 'packs', gained: number }
  | { type: 'gems', amount: number }
