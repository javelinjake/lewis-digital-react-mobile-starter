import type { GameConfig } from './config'
import type { IdleState, WelcomeBackEvent } from './state'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Whole days since the epoch, with the day boundary moved by `dayStartOffsetMinutes`. */
export function dayIndex(now: number, config: GameConfig) {
  return Math.floor((now - config.daily.dayStartOffsetMinutes * MINUTE) / DAY)
}

export function shelfCapacity(state: Pick<IdleState, 'hasPass'>, config: GameConfig) {
  return state.hasPass ? config.shelf.capacityWithPass : config.shelf.capacity
}

export interface AdvanceResult {
  state: IdleState
  /** What changed while the player was away, for the welcome-back summary. */
  events: WelcomeBackEvent[]
}

/**
 * Catches the club up to `now`: fills the shelf and grants the day's gems. Pure, and safe to call as often as you
 * like. Calling it at t1 and then t2 gives the same state as calling it once at t2 (the property the tests check),
 * so an idle game pays the same whether the player looks in every five minutes or once a day.
 *
 * Stadium coins and cabinet tokens are not touched here: they are a pile that grows with time, worked out on demand
 * by `pendingStadiumCoins` / `pendingTrayTokens`, and only collecting changes the state.
 */
export function advance(state: IdleState, config: GameConfig, now: number): AdvanceResult {
  const events: WelcomeBackEvent[] = []
  let next = { ...state, trayCollectedAt: { ...state.trayCollectedAt } }

  // A clock that goes backwards (a server restart on another node, a manual fix) never un-earns anything.
  const at = Math.max(now, state.shelfClockAt)

  // Shelf: one pack per interval, up to the capacity. A full shelf stops the clock; taking a pack restarts it.
  const interval = config.shelf.intervalMinutes * MINUTE
  const capacity = shelfCapacity(next, config)
  if (next.shelfPacks >= capacity) {
    next.shelfClockAt = at
  }
  else {
    const earned = Math.floor((at - next.shelfClockAt) / interval)
    const gained = Math.min(earned, capacity - next.shelfPacks)
    next.shelfPacks += gained
    // Full: the clock idles from now. Otherwise keep the leftover part of the interval.
    next.shelfClockAt = next.shelfPacks >= capacity ? at : next.shelfClockAt + earned * interval
    if (gained > 0)
      events.push({ type: 'packs', gained })
  }

  // Gems: once per day.
  const today = dayIndex(now, config)
  if (today > next.gemsGrantedForDay) {
    const amount = next.hasPass ? config.daily.gemsWithPass : config.daily.gems
    next = { ...next, gems: next.gems + amount, gemsGrantedForDay: today }
    events.push({ type: 'gems', amount })
  }

  return { state: next, events }
}

function pile(perHour: number, since: number, now: number, capHours: number) {
  const hours = Math.min(Math.max(0, now - since) / HOUR, capHours)
  return Math.floor(perHour * hours)
}

/** Coins waiting in the stadium. Fills at the level's rate and stops at the cap. */
export function pendingStadiumCoins(state: IdleState, config: GameConfig, now: number) {
  const perHour = config.stadium.coinsPerHour[Math.min(state.stadiumLevel, config.stadium.coinsPerHour.length) - 1]
  const capHours = state.hasPass ? config.stadium.capHoursWithPass : config.stadium.capHours
  return pile(perHour, state.stadiumCollectedAt, now, capHours)
}

/** Tokens waiting in one cabinet's tray. */
export function pendingTrayTokens(state: IdleState, config: GameConfig, cabinet: 'kick' | 'keepy', now: number) {
  const capHours = state.hasPass ? config.cabinets.trayCapHoursWithPass : config.cabinets.trayCapHours
  return pile(config.cabinets.tokensPerHour, state.trayCollectedAt[cabinet], now, capHours)
}

/** When each alert should fire, given what the player has now. The app turns these into local notifications. */
export function notificationTimes(state: IdleState, config: GameConfig, now: number) {
  const { state: current } = advance(state, config, now)
  const capacity = shelfCapacity(current, config)
  const interval = config.shelf.intervalMinutes * MINUTE
  const stadiumCap = (current.hasPass ? config.stadium.capHoursWithPass : config.stadium.capHours) * HOUR
  const trayCap = (current.hasPass ? config.cabinets.trayCapHoursWithPass : config.cabinets.trayCapHours) * HOUR

  return {
    /** Null when the shelf is already full: there is nothing to wait for. */
    shelfFullAt: current.shelfPacks >= capacity ? null : current.shelfClockAt + (capacity - current.shelfPacks) * interval,
    stadiumFullAt: current.stadiumCollectedAt + stadiumCap,
    traysFullAt: Math.min(current.trayCollectedAt.kick, current.trayCollectedAt.keepy) + trayCap,
  }
}
