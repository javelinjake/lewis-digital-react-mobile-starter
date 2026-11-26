import type { GameConfig } from './config'
import type { Fielded } from './lineup'
import type { MatchEvent, MatchResult } from './match'
import type { FormationId, Position } from './positions'
import { createRng, hashSeed } from '@ld/utils/random/rng'
import { inventName, NATIONS } from './catalogue'
import { scoreLineup } from './lineup'
import { matchOdds, playMatch } from './match'
import { FORMATION_IDS, FORMATIONS } from './positions'

const HOUR = 60 * 60 * 1000

/** Where a club stands in the ladder. Tier 1 is League 5 and tier 5 is League 1; Prestige tiers continue from 6. */
export interface LeagueState {
  tier: number
  points: number
  /** Matches played or skipped so far. Seeds each match and picks the next rival. */
  fixtureNo: number
  nextKickoffAt: number
  /** ATT bonus waiting for the next match from the warm-up kick. */
  warmupBonus: number
  /** `fixtureNo` when the club arrived in this tier, so the table knows how many rounds have been played in it. */
  tierStartNo?: number
}

/**
 * The time before league match `no` (counting from 0), from the one before it or, for the first, from founding the
 * club. The first few are minutes apart (`openingGapsMinutes`), so a new player sees the league move; then the full
 * interval.
 */
export function gapBefore(no: number, config: GameConfig): number {
  const opening = config.league.openingGapsMinutes
  return no < opening.length ? opening[no] * 60_000 : config.league.matchIntervalHours * HOUR
}

export function newLeagueState(now: number, config: GameConfig): LeagueState {
  return { tier: 1, points: 0, fixtureNo: 0, nextKickoffAt: now + gapBefore(0, config), warmupBonus: 0, tierStartNo: 0 }
}

/** How many league matches are due by `now`, counting the one at `nextKickoffAt`. */
function dueCount(league: LeagueState, now: number, config: GameConfig): number {
  let due = 0
  let no = league.fixtureNo
  let at = league.nextKickoffAt
  // The opening gaps one at a time; there are only a few.
  while (at <= now && no + 1 < config.league.openingGapsMinutes.length) {
    due += 1
    no += 1
    at += gapBefore(no, config)
  }
  if (at <= now)
    due += Math.floor((now - at) / (config.league.matchIntervalHours * HOUR)) + 1
  return due
}

/** Moves the schedule on `count` matches without playing them: the number and the next kick-off. */
function skipMatches(league: LeagueState, count: number, config: GameConfig): LeagueState {
  let no = league.fixtureNo
  let at = league.nextKickoffAt
  let left = count
  while (left > 0 && no + 1 < config.league.openingGapsMinutes.length) {
    no += 1
    at += gapBefore(no, config)
    left -= 1
  }
  return { ...league, fixtureNo: no + left, nextKickoffAt: at + left * config.league.matchIntervalHours * HOUR }
}

/** Points needed to go up from `tier`. Each league asks more than the last; the Prestige tiers keep climbing. */
export function promotionGate(tier: number, config: GameConfig): number {
  const gates = config.league.promotionPoints
  const index = Math.max(1, tier) - 1
  return index < gates.length ? gates[index] : gates[gates.length - 1] + (index - gates.length + 1) * config.league.prestigeGateStep
}

export type LeagueLabel = { kind: 'league', league: number } | { kind: 'prestige', level: number }

/** "League 5" for tier 1 up to "League 1" for tier 5, then Prestige 1, 2, 3… */
export function leagueLabel(tier: number): LeagueLabel {
  return tier <= 5 ? { kind: 'league', league: 6 - Math.max(1, tier) } : { kind: 'prestige', level: tier - 5 }
}

/** The last tier that is a league (League 1); higher tiers are Prestige. */
const LAST_LEAGUE_TIER = 5

/**
 * Average rating of the rivals in a tier. Each league up adds `rivalStep`; each Prestige tier adds the smaller
 * `rivalPrestigeStep`, up to `rivalMaxRating`, so the ladder keeps getting harder without outgrowing the best cards.
 */
export function tierRating(tier: number, config: GameConfig): number {
  const { rivalBaseRating, rivalStep, rivalPrestigeStep, rivalMaxRating } = config.league
  const at = Math.max(1, tier)
  const leagues = Math.min(at, LAST_LEAGUE_TIER) - 1
  const prestige = Math.max(0, at - LAST_LEAGUE_TIER)
  return Math.min(rivalMaxRating, rivalBaseRating + leagues * rivalStep + prestige * rivalPrestigeStep)
}

/** Prestige tiers reached: 0 until the club goes up from League 1. */
export const prestigeLevel = (tier: number) => Math.max(0, tier - LAST_LEAGUE_TIER)

/** Coins with the club's Prestige bonus: +2% for each Prestige tier reached, by default. */
export function withPrestige(coins: number, tier: number, config: GameConfig): number {
  return Math.round(coins * (1 + prestigeLevel(tier) * config.prestige.coinBonusPerTier))
}

export interface Rival {
  index: number
  name: string
  formation: FormationId
  rating: number
  att: number
  def: number
  roles: readonly Position[]
  /** Invented names for the five players, in the order of `roles`. The same every time for a tier and rival. */
  names: string[]
}

const CLUB_SUFFIXES = ['Rovers', 'Athletic', 'Town', 'Wanderers', 'Albion', 'Rangers', 'City', 'Dynamos', 'United', 'Harriers']

/** ATT and DEF of a side of five equally rated players, all in position, in a formation. */
export function formationStrength(formation: FormationId, rating: number) {
  const players: Fielded[] = FORMATIONS[formation].roles.map((role, index) => ({ position: role, nation: index % NATIONS.length, rating }))
  const score = scoreLineup(formation, players)
  return { att: score.att, def: score.def }
}

/**
 * The five rivals in a tier: always the same five for a tier, strongest to weakest spread around the tier's rating.
 * `rivals = teams - 1`, because the player's club is the sixth.
 */
export function generateRivals(tier: number, config: GameConfig): Rival[] {
  const rng = createRng(hashSeed('rivals', tier))
  const count = config.league.teams - 1
  const names = rng.shuffle(NATIONS.flatMap(nation => CLUB_SUFFIXES.map(suffix => `${nation} ${suffix}`))).slice(0, count)
  const base = tierRating(tier, config)

  return names.map((name, index) => {
    const offset = count === 1 ? 0 : Math.round((index / (count - 1) - 0.5) * 2 * config.league.rivalSpread)
    const rating = base + offset
    const formation = rng.pick(FORMATION_IDS)
    const squad = rng.fork(`squad-${index}`)
    const used = new Set<string>()
    const names = FORMATIONS[formation].roles.map(() => {
      let player = ''
      while (!player || used.has(player))
        player = inventName(squad, squad.int(0, NATIONS.length - 1))
      used.add(player)
      return player
    })
    return { index, name, formation, rating, ...formationStrength(formation, rating), roles: FORMATIONS[formation].roles, names }
  })
}

export interface LineupForMatch {
  formation: FormationId
  players: ReadonlyArray<Fielded | null>
  /** Who is in each slot, for the match report. A missing name is shown as "A trialist". */
  names?: ReadonlyArray<string | null>
  /** Extra team power from finished album sets, as a fraction. */
  bonus?: number
}

/** The two squads' names in slot order, kept with the fixture so a match report reads the same later. */
export interface MatchSquads {
  ours: string[]
  theirs: string[]
}

export interface FixtureResult {
  no: number
  /** Our formation in this match. */
  formation: FormationId
  squads: MatchSquads
  tier: number
  kickoffAt: number
  rival: Pick<Rival, 'index' | 'name' | 'formation' | 'rating' | 'att' | 'def'>
  goalsFor: number
  goalsAgainst: number
  result: MatchResult
  points: number
  coins: number
  events: MatchEvent[]
  warmupBonus: number
  /** Set when this match took the club up a league. */
  promotedTo: number | null
}

export interface CatchUpResult {
  league: LeagueState
  results: FixtureResult[]
  coins: number
  /** Matches the player was away for so long that they were not played. */
  skipped: number
}

export const pointsFor = (result: MatchResult, config: GameConfig) => (result === 'win' ? config.league.winPoints : result === 'draw' ? config.league.drawPoints : config.league.lossPoints)
export const coinsFor = (result: MatchResult, config: GameConfig) => (result === 'win' ? config.league.winCoins : result === 'draw' ? config.league.drawCoins : config.league.lossCoins)

/**
 * Plays every match that fell due while the player was away, in order, each from its own seed (club + match number), so
 * playing them later gives the same results as playing them on time. They use the lineup as it is now, because a
 * player who is away cannot change it. Every result pays coins; a loss pays no points. Reaching the tier's gate (`promotionGate`) promotes; there is no relegation.
 */
export function playDueFixtures(input: { league: LeagueState, lineup: LineupForMatch, clubId: string | number, config: GameConfig, now: number }): CatchUpResult {
  const { lineup, clubId, config, now } = input
  let league = { ...input.league }
  const results: FixtureResult[] = []
  let coins = 0
  let skipped = 0

  const due = dueCount(league, now, config)
  const toPlay = Math.min(due, config.league.maxCatchUpMatches)
  if (due > toPlay) {
    // Away for longer than the limit: the oldest matches are not played, and the rival rotation moves on.
    skipped = due - toPlay
    league = skipMatches(league, skipped, config)
  }

  const score = scoreLineup(lineup.formation, lineup.players, lineup.bonus ?? 0)
  let rivals = generateRivals(league.tier, config)

  for (let played = 0; played < toPlay; played++) {
    const rival = rivals[league.fixtureNo % rivals.length]
    const warmup = league.warmupBonus
    const outcome = playMatch({
      formation: lineup.formation,
      att: score.att,
      def: score.def,
      slots: score.slots.map(slot => ({ role: slot.role, score: slot.score })),
      opponent: { formation: rival.formation, att: rival.att, def: rival.def, roles: rival.roles },
      warmupBonus: warmup,
      seed: hashSeed(clubId, 'fixture', league.fixtureNo),
    }, config)

    const points = pointsFor(outcome.result, config)
    const matchCoins = withPrestige(coinsFor(outcome.result, config), league.tier, config)
    const kickoffAt = league.nextKickoffAt
    const tier = league.tier

    let promotedTo: number | null = null
    let nextPoints = league.points + points
    let nextTier = league.tier
    if (nextPoints >= promotionGate(league.tier, config)) {
      nextTier += 1
      nextPoints = 0
      promotedTo = nextTier
    }

    results.push({
      no: league.fixtureNo,
      formation: lineup.formation,
      squads: { ours: FORMATIONS[lineup.formation].roles.map((_, slot) => lineup.names?.[slot] ?? 'A trialist'), theirs: rival.names },
      tier,
      kickoffAt,
      rival: { index: rival.index, name: rival.name, formation: rival.formation, rating: rival.rating, att: rival.att, def: rival.def },
      goalsFor: outcome.goalsFor,
      goalsAgainst: outcome.goalsAgainst,
      result: outcome.result,
      points,
      coins: matchCoins,
      events: outcome.events,
      warmupBonus: warmup,
      promotedTo,
    })
    coins += matchCoins
    league = { tier: nextTier, points: nextPoints, fixtureNo: league.fixtureNo + 1, nextKickoffAt: kickoffAt + gapBefore(league.fixtureNo + 1, config), warmupBonus: 0, tierStartNo: promotedTo ? league.fixtureNo + 1 : league.tierStartNo ?? 0 }
    if (promotedTo)
      rivals = generateRivals(league.tier, config)
  }

  return { league, results, coins, skipped }
}

export interface TableRow {
  name: string
  /** The player's own club. */
  isClub: boolean
  played: number
  points: number
}

/**
 * The six-team table for the club's current tier. The club's row is its real points. Each rival plays one match a
 * round against an average side of the tier, seeded by club, tier and round, so the table is the same on every
 * device and every sync, and stronger rivals finish higher more often.
 */
export function leagueTable(input: { league: LeagueState, clubName: string, clubId: string | number, config: GameConfig }): TableRow[] {
  const { league, clubName, clubId, config } = input
  const start = league.tierStartNo ?? 0
  const played = Math.max(0, league.fixtureNo - start)
  const average = { formation: '2-2' as FormationId, ...formationStrength('2-2', tierRating(league.tier, config)) }

  const rivals = generateRivals(league.tier, config).map((rival) => {
    const odds = matchOdds({ formation: rival.formation, att: rival.att, def: rival.def }, average, config)
    let points = 0
    for (let round = start; round < league.fixtureNo; round++) {
      const roll = createRng(hashSeed(clubId, 'table', league.tier, round, rival.index)).next()
      points += roll < odds.win ? config.league.winPoints : roll < odds.win + odds.draw ? config.league.drawPoints : config.league.lossPoints
    }
    return { name: rival.name, isClub: false, played, points }
  })

  return [{ name: clubName, isClub: true, played, points: league.points }, ...rivals]
    .sort((a, b) => b.points - a.points || Number(b.isClub) - Number(a.isClub) || a.name.localeCompare(b.name))
}
