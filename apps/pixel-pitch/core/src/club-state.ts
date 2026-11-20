import type { GameConfig, GoalKind } from './config'
import type { LeagueState } from './league'
import type { FormationId } from './positions'
import type { IdleState } from './state'
import { newLeagueState } from './league'
import { SLOT_COUNT } from './lineup'
import { newIdleState } from './state'

/** Where an opened pack came from. */
export type PackSource = 'shelf' | 'star' | 'buy' | 'arcade'

/** A pack that has been opened but not yet decided on: the three players wait to be signed or sold. */
export interface PendingPack {
  /** Which pack this was (1 for the first the club opened). Seeds the roll. */
  no: number
  source: PackSource
  playerIds: string[]
  /** Whether the Star guarantee, not luck, produced each player. */
  guaranteed: boolean[]
}

/** A count that belongs to one day and starts again at 0 on the next. */
export interface DayCounter {
  day: number
  count: number
}

export type Cabinet = 'kick' | 'keepy'

/** One play of an arcade game or the warm-up kick. The server hands it out and checks the result against it. */
export interface Ticket {
  id: string
  kind: Cabinet | 'warmup'
  /** Fixes the game's layout (target positions, ball kicks), so the server can replay the player's taps. */
  seed: string
  issuedAt: number
  /** A play bought with gems pays coins and Pass XP, never tokens. */
  paid: boolean
}

export interface DailyGoal {
  id: string
  kind: GoalKind
  target: number
  progress: number
  claimed: boolean
}

/** Everything about a club that changes with time or with the player's choices, apart from the cards themselves. */
export interface ClubState {
  idle: IdleState
  league: LeagueState
  formation: FormationId
  /** Card id in each of the five slots, `null` for an empty slot. */
  lineup: Array<string | null>
  /** Players opened since the last Star or better, for the pack guarantee. */
  pity: number
  coins: number
  tokens: number

  /** Packs opened so far. Seeds each roll, so a pack is never rolled twice. */
  packsOpened: number
  pendingPack: PendingPack | null
  /** Packs guaranteed a Star or better (from the calendar and the pass), waiting to be opened. */
  starPacks: number
  /** Packs bought with coins today. */
  extraPacks: DayCounter

  /** Free plays used today, for each arcade game. */
  cabinetPlays: Record<Cabinet, DayCounter>
  /** Tickets handed out so far. Seeds each play. */
  ticketsIssued: number
  ticket: Ticket | null
  /** The league match the warm-up kick was last tried for: one try a match. */
  warmupTriedFor: number

  daily: { day: number, goals: DailyGoal[], freePackClaimed: boolean }
  /** The login calendar: `streak` days claimed in a row, the last on day `lastClaimDay`. */
  calendar: { streak: number, lastClaimDay: number }
  pass: { season: number, xp: number, claimedFree: number[], claimedPremium: number[] }
  /** The album: every player ever pulled, how many sets are finished, which finished sets paid out. */
  album: { collected: string[], completed: number, claimed: string[] }
}

export function newClubState(now: number, config: GameConfig): ClubState {
  return {
    idle: newIdleState(now),
    league: newLeagueState(now, config),
    formation: '2-2',
    lineup: Array.from({ length: SLOT_COUNT }, () => null),
    pity: 0,
    coins: 0,
    tokens: 0,
    packsOpened: 0,
    pendingPack: null,
    starPacks: 0,
    extraPacks: { day: -1, count: 0 },
    cabinetPlays: { kick: { day: -1, count: 0 }, keepy: { day: -1, count: 0 } },
    ticketsIssued: 0,
    ticket: null,
    warmupTriedFor: -1,
    daily: { day: -1, goals: [], freePackClaimed: false },
    calendar: { streak: 0, lastClaimDay: -1 },
    pass: { season: -1, xp: 0, claimedFree: [], claimedPremium: [] },
    album: { collected: [], completed: 0, claimed: [] },
  }
}

/**
 * A saved club from an older version of the game gets every field added since filled with its starting value, so
 * adding to `ClubState` never breaks a club already in the database. Fields it already has are kept as they are.
 */
export function upgradeState(saved: Partial<ClubState> & Pick<ClubState, 'idle' | 'league'>, config: GameConfig): ClubState {
  const fresh = newClubState(saved.idle.shelfClockAt, config)
  return {
    ...fresh,
    ...saved,
    cabinetPlays: { ...fresh.cabinetPlays, ...saved.cabinetPlays },
    daily: { ...fresh.daily, ...saved.daily },
    calendar: { ...fresh.calendar, ...saved.calendar },
    pass: { ...fresh.pass, ...saved.pass },
    album: { ...fresh.album, ...saved.album },
    extraPacks: { ...fresh.extraPacks, ...saved.extraPacks },
  }
}
