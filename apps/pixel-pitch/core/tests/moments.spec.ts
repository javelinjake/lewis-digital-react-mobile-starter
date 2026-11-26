import type { AnyTaps, ClubState, FixtureResult, FlowContext, MatchEvent } from '../src'
import { describe, expect, it } from 'vitest'
import { CHANCE_CABINET, chanceFor, changeFixture, DEFAULT_CONFIG, difficultyAt, earnsBigChance, finishChance, finishPlay, generateCatalogue, isGameRuleError, minigamesAt, newClubState, perfectTaps, playConfig, scoreKick, scorePenalties, skipChance, startChance, startPlay, takeMoments, upgradeState } from '../src'

const config = DEFAULT_CONFIG
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const T0 = Date.UTC(2026, 10, 9, 12)
const catalogue = generateCatalogue(config)
const byId = new Map(catalogue.map(player => [player.id, player]))

function fixture(no: number, goalsFor: number, goalsAgainst: number, kickoffAt = T0 - HOUR, tier = 1): FixtureResult {
  const events: MatchEvent[] = [
    ...Array.from({ length: goalsFor }, (_, goal) => ({ minute: 5 + goal * 7, side: 'for' as const, kind: 'goal' as const, slot: 3 })),
    ...Array.from({ length: goalsAgainst }, (_, goal) => ({ minute: 8 + goal * 9, side: 'against' as const, kind: 'goal' as const, slot: 4 })),
  ].sort((a, b) => a.minute - b.minute)
  const result = goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss'
  return {
    no,
    formation: '2-2',
    squads: { ours: [], theirs: [] },
    tier,
    kickoffAt,
    rival: { index: 0, name: 'Rival', formation: '2-2', rating: 50, att: 50, def: 50 },
    goalsFor,
    goalsAgainst,
    result,
    points: result === 'win' ? 3 : result === 'draw' ? 1 : 0,
    coins: result === 'win' ? 600 : result === 'draw' ? 400 : 250,
    events,
    warmupBonus: 0,
    promotedTo: null,
  }
}

const context = (state: ClubState, now = T0): FlowContext => ({ state, cards: [], catalogue, players: id => byId.get(id), config, clubId: 'club-1', now })
const code = (run: () => unknown) => {
  try {
    run()
    return 'accepted'
  }
  catch (error) {
    return isGameRuleError(error) ? error.code : 'other'
  }
}

/** Banks one Big Chance from `match` and returns the club holding it. */
function holding(match: FixtureResult, patch: (state: ClubState) => ClubState = state => state) {
  const state = patch(newClubState(T0 - 2 * HOUR, config))
  return takeMoments(state, [match], 'club-1', config, T0).state
}

/** Starts the club's moment for `no`, then finishes it with a perfect play, or a play that misses. */
function play(state: ClubState, no: number, scoreIt: boolean) {
  const started = startChance(context(state), no).state
  const ticket = started.ticket!
  const tuned = playConfig(config, ticket)
  const taps = scoreIt ? perfectTaps(ticket.cabinet!, ticket.seed, tuned) : missTaps(ticket.cabinet!, ticket.seed, tuned)
  return finishChance(context(started, T0 + MINUTE), taps as AnyTaps)
}

/** A play that does not go in: a free kick far off the target, a penalty wide, over or saved, no dive at all. */
function missTaps(cabinet: string, seed: string, tuned: typeof config): AnyTaps {
  if (cabinet === 'keeper')
    return [null]
  for (let ms = 150; ms < 20_000; ms += 10) {
    const score = cabinet === 'kick' ? scoreKick(seed, [ms], tuned).total : scorePenalties(seed, [ms], tuned).total
    if (score === 0)
      return [ms]
  }
  throw new Error('No miss found.')
}

describe('banking Big Chances', () => {
  it('banks a draw and a one-goal loss from a missed match, but not a win or a heavier loss', () => {
    expect(earnsBigChance(fixture(0, 1, 1))).toBe(true)
    expect(earnsBigChance(fixture(0, 1, 2))).toBe(true)
    expect(earnsBigChance(fixture(0, 2, 1))).toBe(false)
    expect(earnsBigChance(fixture(0, 0, 2))).toBe(false)
    const { state, banked } = takeMoments(newClubState(T0, config), [fixture(0, 1, 1), fixture(1, 2, 0), fixture(2, 0, 1), fixture(3, 0, 3)], 'club-1', config, T0)
    expect(banked).toBe(2)
    expect(state.chances.map(chance => chance.fixtureNo)).toEqual([0, 2])
    expect(state.live).toBeNull()
  })

  it('offers a save only where there is a goal against to keep out', () => {
    for (let no = 0; no < 40; no++)
      expect(chanceFor(fixture(no, 0, 0), 'club-1', config, false, T0).kind).not.toBe('save')
    const kinds = new Set(Array.from({ length: 40 }, (_, no) => chanceFor(fixture(no, 0, 1), 'club-1', config, false, T0).kind))
    expect(kinds).toEqual(new Set(['penalty', 'freekick', 'save']))
  })

  it('holds five; the newest replaces the oldest', () => {
    const draws = Array.from({ length: 7 }, (_, no) => fixture(no, 0, 0))
    const { state } = takeMoments(newClubState(T0, config), draws, 'club-1', config, T0)
    expect(state.chances.map(chance => chance.fixtureNo)).toEqual([2, 3, 4, 5, 6])
  })

  it('gives a match the player was there for a live moment instead, whatever the score, never both', () => {
    const watched = fixture(4, 3, 0, T0 - 2 * MINUTE)
    const { state, banked } = takeMoments(newClubState(T0, config), [fixture(3, 1, 1), watched], 'club-1', config, T0)
    expect(banked).toBe(1)
    expect(state.live).toMatchObject({ fixtureNo: 4, live: true })
    expect(state.chances.map(chance => chance.fixtureNo)).toEqual([3])
    // A drawn match watched live is not banked as well.
    const level = takeMoments(newClubState(T0, config), [fixture(5, 1, 1, T0 - MINUTE)], 'club-1', config, T0).state
    expect(level.chances).toEqual([])
    expect(level.live?.fixtureNo).toBe(5)
  })

  it('lets a live moment run out', () => {
    const state = takeMoments(newClubState(T0, config), [fixture(4, 0, 0, T0 - MINUTE)], 'club-1', config, T0).state
    expect(takeMoments(state, [], 'club-1', config, T0 + HOUR).state.live).toBeNull()
    expect(code(() => startChance(context(state, T0 + HOUR), 4))).toBe('expired')
  })
})

describe('playing a Big Chance', () => {
  it('turns a draw into a win: two more points and 200 more coins', () => {
    const state = holding(fixture(0, 1, 1))
    const result = play(state, 0, true)
    expect(result.extra).toMatchObject({ scored: true, before: 'draw', after: 'win', points: 2, coins: 200 })
    expect(result.state.league.points).toBe(state.league.points + 2)
    expect(result.state.coins).toBe(state.coins + 200)
    expect(result.ledger).toEqual([{ currency: 'coins', amount: 200, reason: 'big-chance', ref: 'fixture 0' }])
    expect(result.extra!.change).toMatchObject({ no: 0, result: 'win', points: 3, coins: 600 })
  })

  it('turns a one-goal loss into a draw', () => {
    const result = play(holding(fixture(0, 1, 2)), 0, true)
    expect(result.extra).toMatchObject({ before: 'loss', after: 'draw', points: 1, coins: 150 })
  })

  it('costs nothing when missed, and the result stands', () => {
    const state = holding(fixture(0, 1, 1))
    const result = play(state, 0, false)
    expect(result.extra).toMatchObject({ scored: false, after: 'draw', points: 0, coins: 0, change: null })
    expect(result.state.league.points).toBe(state.league.points)
    expect(result.state.coins).toBe(state.coins)
  })

  it('has one attempt: it leaves the bank when started', () => {
    const state = holding(fixture(0, 1, 1))
    const started = startChance(context(state), 0).state
    expect(started.chances).toEqual([])
    expect(started.ticket).toMatchObject({ kind: 'chance', cabinet: CHANCE_CABINET[state.chances[0].kind] })
    expect(code(() => startChance(context(started), 0))).toBe('no-chance')
  })

  it('pays coins only once the club has left that league', () => {
    const state = holding(fixture(0, 1, 1, T0 - HOUR, 1), club => club)
    const moved = { ...state, league: { ...state.league, tier: 2, points: 0 } }
    const result = play(moved, 0, true)
    expect(result.extra).toMatchObject({ scored: true, points: 0, coins: 200 })
    expect(result.state.league.points).toBe(0)
  })

  it('promotes there and then when its points reach the gate', () => {
    const state = holding(fixture(0, 1, 1), club => ({ ...club, league: { ...club.league, points: 29, fixtureNo: 12 } }))
    const result = play(state, 0, true)
    expect(result.extra!.promotedTo).toBe(2)
    expect(result.state.league).toMatchObject({ tier: 2, points: 0, tierStartNo: 12 })
  })

  it('survives the club being loaded again between start and finish', () => {
    const started = startChance(context(holding(fixture(0, 1, 1))), 0).state
    expect(upgradeState(started, config).ticket).toEqual(started.ticket)
  })

  it('can be let go, which counts as a miss', () => {
    const state = holding(fixture(0, 1, 1))
    const skipped = skipChance(context(state), 0).state
    expect(skipped.chances).toEqual([])
    expect(skipped.league).toEqual(state.league)
  })

  it('is refused for a match it was not offered for', () => {
    expect(code(() => startChance(context(holding(fixture(0, 1, 1))), 9))).toBe('no-chance')
  })
})

describe('the stored match', () => {
  it('gains the goal at the moment\'s minute, told as a penalty or free kick', () => {
    const match = fixture(0, 1, 1)
    const changed = changeFixture(match, { no: 0, kind: 'penalty', minute: 30, goalsFor: 2, goalsAgainst: 1, result: 'win', points: 3, coins: 600, promotedTo: null })
    expect(changed).toMatchObject({ goalsFor: 2, goalsAgainst: 1, result: 'win', points: 3, coins: 600 })
    expect(changed.events.filter(event => event.side === 'for' && event.kind === 'goal')).toHaveLength(2)
    expect(changed.events.find(event => event.chance)).toMatchObject({ minute: 30, kind: 'goal', chance: 'penalty' })
  })

  it('turns the deciding goal into a save', () => {
    const match = fixture(0, 1, 2)
    const decider = match.events.filter(event => event.side === 'against').at(-1)!
    const changed = changeFixture(match, { no: 0, kind: 'save', minute: decider.minute, goalsFor: 1, goalsAgainst: 1, result: 'draw', points: 1, coins: 400, promotedTo: null })
    expect(changed.events.filter(event => event.side === 'against' && event.kind === 'goal')).toHaveLength(1)
    expect(changed.events.find(event => event.chance)).toMatchObject({ minute: decider.minute, kind: 'save', chance: 'save' })
  })
})

describe('difficulty by league', () => {
  it('is as written in League 5 and quicker each league after, up to the cap', () => {
    expect(difficultyAt(config.minigames, 1)).toBe(0)
    expect(difficultyAt(config.minigames, 3)).toBeCloseTo(0.16)
    expect(difficultyAt(config.minigames, 50)).toBe(config.minigames.difficulty.max)
    const third = minigamesAt(config.minigames, 3)
    expect(third.kick.maxSpeed).toBeCloseTo(config.minigames.kick.maxSpeed * 1.16)
    expect(third.keeper.lastWindowMs).toBeCloseTo(config.minigames.keeper.lastWindowMs / 1.16)
    expect(third.pens.keeperLegMinMs).toBeLessThan(config.minigames.pens.keeperLegMinMs)
  })

  it('makes a match moment one round of its game', () => {
    const tuned = playConfig(config, { kind: 'chance', tier: 1 }).minigames
    expect([tuned.kick.rounds, tuned.pens.rounds, tuned.keeper.shots]).toEqual([1, 1, 1])
  })

  it('stamps an arcade play with the club\'s league and scores it at that league\'s pace', () => {
    const state: ClubState = { ...newClubState(T0, config), league: { ...newClubState(T0, config).league, tier: 4 } }
    const started = startPlay(context(state), 'kick', false).state
    expect(started.ticket?.tier).toBe(4)
    const taps = perfectTaps('kick', started.ticket!.seed, playConfig(config, started.ticket))
    const result = finishPlay(context(started, T0 + MINUTE), 'kick', taps as number[])
    expect(result.extra!.score).toBe(result.extra!.max)
  })
})
