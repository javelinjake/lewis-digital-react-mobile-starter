import type { AnyTaps } from './arcade-taps'
import type { Cabinet, ClubState, Ticket } from './club-state'
import type { GameConfig, Reward } from './config'
import type { FlowContext, FlowResult, LedgerEntry } from './flow'
import type { Medal } from './mastery'
import { dayIndex } from './advance'
import { scorePlay } from './arcade-taps'
import { GameRuleError } from './errors'
import { checkTiming, hotCabinet } from './flow-arcade'
import { MEDALS } from './mastery'
import { playConfig } from './play-config'
import { addXp, grantReward, recordProgress } from './progress'

// The daily challenge. Every day every player gets the same arcade game (the day's featured one) with the same
// pattern, in endless mode, for one scored attempt. Practice happens in the normal arcade; this pattern is only
// playable in the attempt. Scores go on a shared leaderboard (the api's `challenge-entries`), and a week's best days
// decide its rewards.

/** The day's game: the featured game of the day. */
export function challengeCabinet(now: number, config: GameConfig): Cabinet {
  return hotCabinet(now, config)
}

/** The day's pattern, the same for every player. */
export const challengeSeed = (day: number) => `challenge:${day}`

/** Weeks are seven of the game's days, numbered from the epoch. */
export const weekOf = (day: number) => Math.floor(day / 7)

/** Whether the club has had today's attempt. */
export function challengePlayed(state: Pick<ClubState, 'challenge'>, now: number, config: GameConfig) {
  return state.challenge.day === dayIndex(now, config)
}

/** Starts today's attempt. One a day, free, no energy: it counts as played from now, finished or not. */
export function startChallenge(ctx: FlowContext): FlowResult {
  const { state, config, now } = ctx
  const day = dayIndex(now, config)
  if (state.challenge.day === day)
    throw new GameRuleError('played', 'You have had today\'s attempt. A new challenge comes tomorrow.')
  const number = state.ticketsIssued + 1
  const ticket: Ticket = { id: String(number), kind: 'challenge', cabinet: challengeCabinet(now, config), seed: challengeSeed(day), issuedAt: now, paid: false, tier: 1 }
  const weeks = [...new Set([...state.challenge.weeks, weekOf(day)])].slice(-3)
  return { state: { ...state, ticketsIssued: number, ticket, challenge: { ...state.challenge, day, score: 0, weeks } } }
}

/** The finished week whose reward is waiting, or null: last week, if the club played in it and has not taken it. */
export function weekToClaim(state: Pick<ClubState, 'challenge'>, now: number, config: GameConfig): number | null {
  const lastWeek = weekOf(dayIndex(now, config)) - 1
  return state.challenge.weeks.includes(lastWeek) && state.challenge.claimedWeek < lastWeek ? lastWeek : null
}

/** The gaps a play's taps make, in milliseconds, for the regularity check. */
function tapGaps(cabinet: Cabinet, taps: AnyTaps): number[] {
  const times = (() => {
    switch (cabinet) {
      case 'kick':
      case 'pens': return taps as number[]
      case 'keeper': return (taps as Array<{ ms: number } | null>).flatMap(tap => (tap ? [tap.ms] : []))
      case 'keepy': {
        const steps = (taps as Array<{ t: number }>).map(tap => tap.t)
        return steps.slice(1).map((step, index) => (step - steps[index]) * (1000 / 60))
      }
      case 'dribble': {
        const ms = (taps as Array<{ ms: number }>).map(tap => tap.ms)
        return ms.slice(1).map((at, index) => at - ms[index])
      }
    }
  })()
  return times.filter(gap => gap > 0)
}

/**
 * Why a score should be held off the boards until someone looks at it, or null. Server replay proves a score
 * happened, not that a person made it: a score above the plausible ceiling, or taps more even than a person's.
 */
export function judgeEntry(cabinet: Cabinet, score: number, taps: AnyTaps, config: GameConfig): string | null {
  if (score > config.challenge.ceiling[cabinet])
    return 'above-ceiling'
  const gaps = tapGaps(cabinet, taps)
  if (gaps.length >= config.challenge.regularityMinTaps) {
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    const spread = Math.sqrt(gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length)
    if (mean > 0 && spread / mean < config.challenge.regularity)
      return 'too-regular'
  }
  return null
}

export interface ChallengeResult {
  day: number
  cabinet: Cabinet
  score: number
  /** Today's targets reached, lowest first, and what each paid. */
  medals: Medal[]
  rewards: Reward[]
  /** Tokens for taking part. */
  tokens: number
  /** Why the score is held off the boards until reviewed, or null. */
  flagged: string | null
}

/**
 * Finishes today's attempt from the game's taps, replayed with the day's seed in endless mode. Pays a few tokens for
 * taking part and each of the day's targets beaten. The api stores the score on the leaderboard.
 */
export function finishChallenge(ctx: FlowContext, taps: AnyTaps): FlowResult<ChallengeResult> {
  const { state, config } = ctx
  const ticket = state.ticket
  if (!ticket || ticket.kind !== 'challenge' || !ticket.cabinet)
    throw new GameRuleError('no-ticket', 'Start the challenge first.')
  const cabinet = ticket.cabinet
  const { score, playMs } = scorePlay(cabinet, ticket.seed, taps, playConfig(config, ticket))
  checkTiming(ticket, playMs, ctx)
  const day = Number(ticket.seed.split(':')[1])

  let next: ClubState = addXp(recordProgress({ ...state, ticket: null, challenge: { ...state.challenge, day, score } }, 'playChallenge'), config.pass.xp.challenge, config)
  const ledger: LedgerEntry[] = []
  const pay = (reward: Reward, ref: string) => {
    const paid = grantReward(next, reward, 'challenge', ref)
    next = paid.state
    ledger.push(...paid.ledger)
  }
  const tokens = config.challenge.tokens
  if (tokens > 0)
    pay({ kind: 'tokens', amount: tokens }, `day ${day}`)
  const targets = config.challenge.targets[cabinet]
  const medals = MEDALS.filter((_, index) => score >= targets[index])
  const rewards = medals.map(medal => config.challenge.rewards[medal])
  medals.forEach((medal, index) => pay(rewards[index], `day ${day}:${medal}`))

  return { state: next, ledger, extra: { day, cabinet, score, medals, rewards, tokens, flagged: judgeEntry(cabinet, score, taps, config) } }
}

// ---- The weekly board ----

export interface ChallengeEntry {
  owner: string | number
  day: number
  score: number
}

/**
 * Points for a day's result: 0 to 100 by position among that day's players (100 for first, 0 for last), so the five
 * games' different scales add up fairly. Players level on score share the better position.
 */
export function dayPoints(entries: readonly ChallengeEntry[]): Map<string, number> {
  const points = new Map<string, number>()
  const sorted = [...entries].sort((a, b) => b.score - a.score)
  for (const entry of sorted) {
    const above = sorted.findIndex(other => other.score === entry.score)
    points.set(String(entry.owner), sorted.length === 1 ? 100 : Math.round((100 * (sorted.length - 1 - above)) / (sorted.length - 1)))
  }
  return points
}

export interface WeeklyStanding {
  owner: string
  /** The sum of the best `bestDays` days' points. */
  points: number
  /** Days played this week. */
  days: number
}

/** The week's table, best first: each player's best `challenge.bestDays` days count, so a missed day does not end their week. */
export function weeklyTable(entries: readonly ChallengeEntry[], config: GameConfig): WeeklyStanding[] {
  const byDay = new Map<number, ChallengeEntry[]>()
  for (const entry of entries)
    byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry])
  const perPlayer = new Map<string, number[]>()
  for (const dayEntries of byDay.values()) {
    for (const [owner, points] of dayPoints(dayEntries))
      perPlayer.set(owner, [...(perPlayer.get(owner) ?? []), points])
  }
  return [...perPlayer.entries()]
    .map(([owner, days]) => ({ owner, days: days.length, points: [...days].sort((a, b) => b - a).slice(0, config.challenge.bestDays).reduce((sum, value) => sum + value, 0) }))
    .sort((a, b) => b.points - a.points || a.owner.localeCompare(b.owner))
}

/** The weekly band a player reached (the first in the list), or null. `position` counts from 1. */
export function weeklyBand(position: number, players: number, days: number, config: GameConfig) {
  return config.challenge.weekly.find(band =>
    (band.top !== undefined && position <= band.top)
    || (band.share !== undefined && position <= Math.max(1, Math.floor(players * band.share)))
    || (band.days !== undefined && days >= band.days),
  ) ?? null
}

export interface WeeklyClaim {
  week: number
  band: string | null
  label: string | null
  rewards: Reward[]
  badge: string | null
}

/**
 * Takes the reward for a finished week. The server works out the standing (`weeklyTable` of that week's entries) and
 * passes it in; this checks the week is over and not yet taken, and pays the band.
 */
export function claimWeekly(ctx: FlowContext, week: number, standing: { position: number, players: number, days: number } | null): FlowResult<WeeklyClaim> {
  const { state, config, now } = ctx
  if (week >= weekOf(dayIndex(now, config)))
    throw new GameRuleError('week-open', 'This week is not over yet.')
  if (week <= state.challenge.claimedWeek)
    throw new GameRuleError('claimed', 'That week\'s reward has been taken.')
  const band = standing ? weeklyBand(standing.position, standing.players, standing.days, config) : null
  let next: ClubState = { ...state, challenge: { ...state.challenge, claimedWeek: week } }
  const ledger: LedgerEntry[] = []
  for (const reward of band?.rewards ?? []) {
    const paid = grantReward(next, reward, 'challenge-week', `week ${week}:${band!.id}`)
    next = paid.state
    ledger.push(...paid.ledger)
  }
  if (band?.badge && !next.badges.includes(band.badge))
    next = { ...next, badges: [...next.badges, band.badge] }
  return { state: next, ledger, extra: { week, band: band?.id ?? null, label: band?.label ?? null, rewards: band?.rewards ?? [], badge: band?.badge ?? null } }
}
