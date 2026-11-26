import type { AnyTaps } from './arcade-taps'
import type { Cabinet, Chance, ChanceKind, ClubState, Ticket } from './club-state'
import type { GameConfig } from './config'
import type { FlowContext, FlowResult, LedgerEntry } from './flow'
import type { FixtureResult } from './league'
import type { MatchEvent, MatchResult } from './match'
import { createRng, hashSeed } from '@ld/utils/random/rng'
import { scorePlay } from './arcade-taps'
import { GameRuleError } from './errors'
import { checkTiming } from './flow-arcade'
import { coinsFor, pointsFor, promotionGate } from './league'
import { playConfig } from './play-config'
import { addXp } from './progress'

// Match moments. A league match the player missed can bank one Big Chance; a match they watch can offer one live
// moment. Either is one penalty, free kick or save, played with the arcade game for it and replayed by the server.
// Scoring moves the result up a step (a loss to a draw, a draw to a win) and pays the difference. Missing costs nothing.

const MINUTE = 60_000

/** The arcade game each moment is played with. */
export const CHANCE_CABINET: Record<ChanceKind, Cabinet> = { penalty: 'pens', freekick: 'kick', save: 'keeper' }

/** Whether a moment's play went in (or, for a save, was kept out). */
export function chanceScored(kind: ChanceKind, score: number, config: GameConfig): boolean {
  return kind === 'freekick' ? score >= config.moments.freeKickPoints : score >= 1
}

/** A Big Chance is banked from a missed league match that ended level or one goal down. */
export function earnsBigChance(fixture: Pick<FixtureResult, 'result' | 'goalsFor' | 'goalsAgainst'>): boolean {
  return fixture.result === 'draw' || (fixture.result === 'loss' && fixture.goalsAgainst - fixture.goalsFor === 1)
}

/**
 * The moment a match offers: which kind, and when. A save only where there is a goal against to keep out (the last
 * one, the one that decided it); a penalty or free kick at a minute drawn from the match. The same every time.
 */
export function chanceFor(fixture: FixtureResult, clubId: string | number, config: GameConfig, live: boolean, now: number): Chance {
  const rng = createRng(hashSeed(clubId, 'chance', fixture.no))
  const conceded = fixture.events.filter(event => event.side === 'against' && event.kind === 'goal')
  // A save is offered only where it can change something: in a one-goal loss for a Big Chance, any goal against live.
  const canSave = conceded.length > 0 && (live || fixture.result === 'loss')
  const kinds: ChanceKind[] = canSave ? ['penalty', 'freekick', 'save'] : ['penalty', 'freekick']
  const kind = rng.pick(kinds)
  const minute = kind === 'save' ? conceded[conceded.length - 1].minute : rng.int(5, config.match.minutes - 3)
  return {
    fixtureNo: fixture.no,
    kind,
    minute,
    tier: fixture.tier,
    live,
    expiresAt: live ? now + config.moments.liveWindowMinutes * 6 * MINUTE : null,
    goalsFor: fixture.goalsFor,
    goalsAgainst: fixture.goalsAgainst,
    result: fixture.result,
  }
}

/**
 * After a catch-up: a match the player was there for (kicked off at most `liveWindowMinutes` ago) offers a live
 * moment, whatever the score; a match they missed that ended level or a goal down banks a Big Chance. Never both. The
 * bank holds `moments.bank`; when full the newest replaces the oldest. An old live moment that ran out goes.
 */
export function takeMoments(state: ClubState, fixtures: readonly FixtureResult[], clubId: string | number, config: GameConfig, now: number): { state: ClubState, banked: number } {
  let live = state.live && state.live.expiresAt !== null && state.live.expiresAt > now ? state.live : null
  let chances = [...state.chances]
  let banked = 0
  for (const fixture of fixtures) {
    if (fixture.no < 0)
      continue
    if (fixture.kickoffAt >= now - config.moments.liveWindowMinutes * MINUTE) {
      live = chanceFor(fixture, clubId, config, true, now)
    }
    else if (earnsBigChance(fixture)) {
      chances = [...chances, chanceFor(fixture, clubId, config, false, now)].slice(-config.moments.bank)
      banked++
    }
  }
  return { state: { ...state, live, chances }, banked: Math.min(banked, config.moments.bank) }
}

function findChance(state: ClubState, fixtureNo: number, now: number): Chance {
  if (state.live && state.live.fixtureNo === fixtureNo) {
    if (state.live.expiresAt !== null && state.live.expiresAt <= now)
      throw new GameRuleError('expired', 'That moment has passed.')
    return state.live
  }
  const chance = state.chances.find(entry => entry.fixtureNo === fixtureNo)
  if (!chance)
    throw new GameRuleError('no-chance', 'There is no chance to play for that match.')
  return chance
}

function without(state: ClubState, fixtureNo: number): ClubState {
  return { ...state, live: state.live?.fixtureNo === fixtureNo ? null : state.live, chances: state.chances.filter(entry => entry.fixtureNo !== fixtureNo) }
}

/**
 * Starts a match moment: one try, so it leaves the bank (or the live slot) now, and the ticket carries it. Free: no
 * energy. Difficulty follows the league the club is in now.
 */
export function startChance(ctx: FlowContext, fixtureNo: number): FlowResult {
  const { state, now } = ctx
  const chance = findChance(state, fixtureNo, now)
  const number = state.ticketsIssued + 1
  const cabinet = CHANCE_CABINET[chance.kind]
  const ticket: Ticket = { id: String(number), kind: 'chance', cabinet, seed: `${ctx.clubId}:chance:${fixtureNo}:${number}`, issuedAt: now, paid: false, tier: state.league.tier, chance }
  return { state: { ...without(state, fixtureNo), ticketsIssued: number, ticket } }
}

/** Lets a moment go ("Let it play", or no tap in time): it counts as a miss, and the result stands. */
export function skipChance(ctx: FlowContext, fixtureNo: number): FlowResult {
  findChance(ctx.state, fixtureNo, ctx.now)
  return { state: without(ctx.state, fixtureNo) }
}

/** How a fixture changes when a moment is scored. The api and the mock apply it to the stored match with `changeFixture`. */
export interface FixtureChange {
  no: number
  kind: ChanceKind
  minute: number
  goalsFor: number
  goalsAgainst: number
  result: MatchResult
  /** Points and coins the match is worth now (what it paid before plus the difference). */
  points: number
  coins: number
  promotedTo: number | null
}

export interface ChanceResult {
  kind: ChanceKind
  fixtureNo: number
  scored: boolean
  score: number
  max: number
  /** The result before and after. The same when the moment was missed. */
  before: MatchResult
  after: MatchResult
  goalsFor: number
  goalsAgainst: number
  /** What it paid on top of the match. Points are 0 when the club has left that league since (coins only). */
  points: number
  coins: number
  promotedTo: number | null
  change: FixtureChange | null
}

const resultOf = (goalsFor: number, goalsAgainst: number): MatchResult => (goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss')

/**
 * Scores the moment from the game's taps, replayed with the ticket's seed at the ticket's difficulty. Scored: a goal
 * for us (or one of theirs kept out), the result moves up and the difference in points and coins is paid. Points go
 * to the league only while the club is still in it; if they reach the gate, the club goes up there and then.
 */
export function finishChance(ctx: FlowContext, taps: AnyTaps): FlowResult<ChanceResult> {
  const { state, config } = ctx
  const ticket = state.ticket
  if (!ticket || ticket.kind !== 'chance' || !ticket.chance || !ticket.cabinet)
    throw new GameRuleError('no-ticket', 'Start the moment first.')
  const chance = ticket.chance
  const { score, max, playMs } = scorePlay(ticket.cabinet, ticket.seed, taps, playConfig(config, ticket))
  checkTiming(ticket, playMs, ctx)
  const scored = chanceScored(chance.kind, score, config)
  const cleared: ClubState = { ...state, ticket: null }
  const missed: ChanceResult = { kind: chance.kind, fixtureNo: chance.fixtureNo, scored: false, score, max, before: chance.result, after: chance.result, goalsFor: chance.goalsFor, goalsAgainst: chance.goalsAgainst, points: 0, coins: 0, promotedTo: null, change: null }
  if (!scored)
    return { state: cleared, extra: missed }

  const goalsFor = chance.goalsFor + (chance.kind === 'save' ? 0 : 1)
  const goalsAgainst = chance.goalsAgainst - (chance.kind === 'save' ? 1 : 0)
  // One goal moves the result a step at most: a loss by one to a draw, a draw to a win. A win stays a win.
  const moved = resultOf(goalsFor, goalsAgainst)
  const sameLeague = chance.tier === state.league.tier
  const points = sameLeague ? pointsFor(moved, config) - pointsFor(chance.result, config) : 0
  const coins = coinsFor(moved, config) - coinsFor(chance.result, config)

  let league = { ...state.league, points: state.league.points + points }
  let promotedTo: number | null = null
  if (sameLeague && points > 0 && league.points >= promotionGate(league.tier, config)) {
    promotedTo = league.tier + 1
    league = { ...league, tier: promotedTo, points: 0, tierStartNo: league.fixtureNo }
  }

  let next: ClubState = { ...cleared, league, coins: state.coins + coins }
  if (moved === 'win' && chance.result !== 'win')
    next = addXp(next, config.pass.xp.win, config)
  const ledger: LedgerEntry[] = coins > 0 ? [{ currency: 'coins', amount: coins, reason: chance.live ? 'live-moment' : 'big-chance', ref: `fixture ${chance.fixtureNo}` }] : []
  const change: FixtureChange = {
    no: chance.fixtureNo,
    kind: chance.kind,
    minute: chance.minute,
    goalsFor,
    goalsAgainst,
    result: moved,
    points: pointsFor(chance.result, config) + points,
    coins: coinsFor(moved, config),
    promotedTo,
  }
  return { state: next, ledger, extra: { ...missed, scored: true, after: moved, goalsFor, goalsAgainst, points, coins, promotedTo, change } }
}

/**
 * The stored match with a scored moment in it: the new score and result, and the moment in the events (a goal for
 * us at its minute, or their goal turned into a save), so the report tells it. Pure: the api and the mock both use it.
 */
export function changeFixture(fixture: FixtureResult, change: FixtureChange): FixtureResult {
  let events: MatchEvent[]
  if (change.kind === 'save') {
    const conceded = fixture.events.flatMap((event, position) => (event.side === 'against' && event.kind === 'goal' ? [position] : []))
    const at = conceded.find(position => fixture.events[position].minute === change.minute) ?? conceded[conceded.length - 1]
    events = fixture.events.map((event, position) => (position === at ? { ...event, kind: 'save', chance: 'save' } : event))
  }
  else {
    // The shooter: whoever scored most for us in this match, else a forward slot.
    const slot = fixture.events.find(event => event.side === 'for' && event.kind === 'goal')?.slot ?? 4
    events = [...fixture.events, { minute: change.minute, side: 'for' as const, kind: 'goal' as const, slot, chance: change.kind }]
      .sort((a, b) => a.minute - b.minute || (a.kind === 'goal' ? -1 : 1))
  }
  return {
    ...fixture,
    goalsFor: change.goalsFor,
    goalsAgainst: change.goalsAgainst,
    result: change.result,
    points: change.points,
    coins: change.coins,
    promotedTo: change.promotedTo ?? fixture.promotedTo,
    events,
  }
}
