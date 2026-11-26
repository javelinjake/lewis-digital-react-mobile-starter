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

/** Every arcade game. The hot cabinet of the day follows this order. */
export const CABINETS = ['kick', 'keepy', 'pens', 'keeper', 'dribble'] as const
export type Cabinet = typeof CABINETS[number]

export const isCabinet = (value: unknown): value is Cabinet => CABINETS.includes(value as Cabinet)

/** A match moment: a penalty (Penalty Shootout), a free kick (Kick Timer) or a save (Keeper Reflex), one try. */
export type ChanceKind = 'penalty' | 'freekick' | 'save'

/**
 * A match the player can still change with one moment. A Big Chance is banked from a league match they missed (a
 * draw or a one-goal loss); a live moment comes from one they watched. It holds the result as it stands, so scoring
 * can move it up without the match being played again.
 */
export interface Chance {
  fixtureNo: number
  kind: ChanceKind
  /** When in the match it comes: the commentary stops here for a live moment. */
  minute: number
  /** The league the match was played in. */
  tier: number
  live: boolean
  /** A live moment is offered until this server time; a Big Chance waits in the bank. */
  expiresAt: number | null
  goalsFor: number
  goalsAgainst: number
  result: 'win' | 'draw' | 'loss'
}

/** One play of an arcade game, the warm-up or a match moment. The server hands it out and checks the result against it. */
export interface Ticket {
  id: string
  kind: Cabinet | 'warmup' | 'chance' | 'challenge'
  /** For the warm-up and a match moment: the arcade game it is a play of. */
  cabinet?: Cabinet
  /** The league the club was in when the play started: the games get harder each league. Older tickets have none (League 5). */
  tier?: number
  /** For a match moment: the match it can change. */
  chance?: Chance
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

  /** The arcade's stamina: the time at which it is full again (see `energyAt`). */
  energy: { fullAt: number }
  /**
   * Arcade records: `best` is the best ever in each game; `bests` and `medals` are per game and league (keyed
   * `cabinet:tier`, see `masteryKey`): the personal best there, and the medal held (1 bronze, 2 silver, 3 gold).
   */
  arcade: { best: Record<Cabinet, number>, bests: Record<string, number>, medals: Record<string, number> }
  /** Tickets handed out so far. Seeds each play. */
  ticketsIssued: number
  ticket: Ticket | null
  /** The league match the warm-up was last tried for: one try a match. */
  warmupTriedFor: number

  daily: { day: number, goals: DailyGoal[], freePackClaimed: boolean }
  /** The login calendar: `streak` days claimed in a row, the last on day `lastClaimDay`. */
  calendar: { streak: number, lastClaimDay: number }
  pass: { season: number, xp: number, claimedFree: number[], claimedPremium: number[] }
  /** The album: every player ever pulled, how many sets are finished, which finished sets paid out. */
  album: { collected: string[], completed: number, claimed: string[] }
  /** Friendlies played: `played` in all (seeds each one), and how many paid coins today. */
  friendlies: { played: number, paid: DayCounter }
  /** Big Chances waiting to be played, oldest first. */
  chances: Chance[]
  /** The live moment of the match the player is watching, if there is one. */
  live: Chance | null
  /**
   * The daily challenge: the last day played and its score, the last week whose reward was taken, and the recent
   * weeks played in (the last few), so the app knows when there is a week's reward to look at.
   */
  challenge: { day: number, score: number, claimedWeek: number, weeks: number[] }
  /** Cosmetic badges the club has won, kept for good. */
  badges: string[]
  /** The trophy cabinet: each league the club went up into, and when (0 for one won before the cabinet existed). */
  trophies: Array<{ tier: number, at: number }>
  /** Shop items the club owns, by id (premium kits). Kept for good. */
  cosmetics: string[]
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
    energy: { fullAt: 0 },
    arcade: { best: Object.fromEntries(CABINETS.map(cabinet => [cabinet, 0])) as Record<Cabinet, number>, bests: {}, medals: {} },
    ticketsIssued: 0,
    ticket: null,
    warmupTriedFor: -1,
    daily: { day: -1, goals: [], freePackClaimed: false },
    calendar: { streak: 0, lastClaimDay: -1 },
    pass: { season: -1, xp: 0, claimedFree: [], claimedPremium: [] },
    album: { collected: [], completed: 0, claimed: [] },
    friendlies: { played: 0, paid: { day: -1, count: 0 } },
    chances: [],
    live: null,
    challenge: { day: -1, score: 0, claimedWeek: -1, weeks: [] },
    badges: [],
    trophies: [],
    cosmetics: [],
  }
}

/**
 * A saved club from an older version of the game gets every field added since filled with its starting value, so
 * adding to `ClubState` never breaks a club already in the database. Fields it already has are kept as they are.
 */
export function upgradeState(saved: Partial<ClubState> & Pick<ClubState, 'idle' | 'league'>, config: GameConfig): ClubState {
  const fresh = newClubState(saved.idle.shelfClockAt, config)
  // Older clubs had a token tray for each game and a count of free plays a day. The trays become one, emptied at the
  // earlier of the two times (nothing already earned is lost), and the plays become energy, starting full.
  const { cabinetPlays: _old, ...rest } = saved as typeof saved & { cabinetPlays?: unknown }
  const tray = saved.idle.trayCollectedAt as number | { kick: number, keepy: number }
  // A play of a game since taken out of the arcade, or a warm-up from when it was a timing bar, cannot be finished: it
  // goes. An unfinished warm-up gives its try back, since it never paid anything.
  const ticket = saved.ticket ?? null
  const stale = ticket !== null && (ticket.kind === 'warmup' ? !isCabinet(ticket.cabinet) : ticket.kind === 'chance' ? !isCabinet(ticket.cabinet) || !ticket.chance : ticket.kind === 'challenge' ? !isCabinet(ticket.cabinet) : !isCabinet(ticket.kind))
  const warmupBack = stale && ticket.kind === 'warmup' && saved.warmupTriedFor === saved.league.fixtureNo
  return {
    ...fresh,
    ...rest,
    idle: { ...saved.idle, trayCollectedAt: typeof tray === 'number' ? tray : Math.min(tray.kick, tray.keepy) },
    energy: { ...fresh.energy, ...saved.energy },
    // Only the games there are now: the best of one taken out is dropped.
    arcade: {
      best: Object.fromEntries(CABINETS.map(cabinet => [cabinet, saved.arcade?.best?.[cabinet] ?? 0])) as Record<Cabinet, number>,
      bests: saved.arcade?.bests ?? {},
      medals: saved.arcade?.medals ?? {},
    },
    ticket: stale ? null : ticket,
    warmupTriedFor: warmupBack ? fresh.warmupTriedFor : (saved.warmupTriedFor ?? fresh.warmupTriedFor),
    daily: { ...fresh.daily, ...saved.daily },
    calendar: { ...fresh.calendar, ...saved.calendar },
    pass: { ...fresh.pass, ...saved.pass },
    album: { ...fresh.album, ...saved.album },
    extraPacks: { ...fresh.extraPacks, ...saved.extraPacks },
    friendlies: { ...fresh.friendlies, ...saved.friendlies },
    challenge: { ...fresh.challenge, ...saved.challenge },
    // A club from before the cabinet gets its promotions so far, undated.
    trophies: saved.trophies ?? Array.from({ length: Math.max(0, saved.league.tier - 1) }, (_, index) => ({ tier: index + 2, at: 0 })),
  }
}
