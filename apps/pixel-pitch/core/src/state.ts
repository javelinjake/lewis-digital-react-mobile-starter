import type { Reward } from './config'

/** Times are epoch milliseconds from the SERVER clock. The client never supplies one. */
export interface IdleState {
  /** Packs waiting on the shelf. */
  shelfPacks: number
  /** When the next pack's timer started. While the shelf is full the clock idles and is reset when a pack is taken. */
  shelfClockAt: number
  /** Coins in the stadium were last collected at this time; the pile since is derived, never stored. */
  stadiumCollectedAt: number
  stadiumLevel: number
  /** The arcade's token tray, last emptied at. One tray for every cabinet. */
  trayCollectedAt: number
  /** Which day (see `dayIndex`) gems were last granted for. */
  gemsGrantedForDay: number
  gems: number
  /**
   * Whether the League Pass is active. Derived on every sync from `passSeason` (the season it was bought for), so it
   * ends with the season on the server's clock. Kept as a field because the idle timers read it.
   */
  hasPass: boolean
  /** The season the League Pass was bought for, -1 for never. */
  passSeason: number
}

export function newIdleState(now: number): IdleState {
  return {
    shelfPacks: 0,
    shelfClockAt: now,
    stadiumCollectedAt: now,
    stadiumLevel: 1,
    trayCollectedAt: now,
    gemsGrantedForDay: -1,
    gems: 0,
    hasPass: false,
    passSeason: -1,
  }
}

export type WelcomeBackEvent =
  | { type: 'packs', gained: number }
  | { type: 'gems', amount: number }
  | {
    type: 'matches'
    played: number
    won: number
    drawn: number
    lost: number
    coins: number
    /** Matches not played because the player was away longer than the catch-up limit. */
    skipped: number
    /** The highest tier reached, if any match promoted the club. */
    promotedTo: number | null
  }
  /** A promotion paid its rewards. */
  | { type: 'promotion', tier: number, rewards: Reward[] }
  /** The season ended: what was reached on the Pass but not claimed was paid automatically. */
  | { type: 'season-end', rewards: Reward[] }
