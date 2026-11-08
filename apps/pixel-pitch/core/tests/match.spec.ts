import type { FormationId, PoolPlayer, Position, Side } from '../src'
import { describe, expect, it } from 'vitest'
import { bestFormation, DEFAULT_CONFIG, expectedGoals, expectedPoints, FORMATION_IDS, FORMATIONS, formationStrength, matchExpectation, matchOdds, parseConfig, playMatch, scoreLineup, tacticalEdge, warmupBonus } from '../src'

const config = DEFAULT_CONFIG
const slots = (roles: readonly Position[], score = 70) => roles.map(role => ({ role, score }))
const side = (formation: FormationId, rating = 70): Side => ({ formation, ...formationStrength(formation, rating) })
const input = (over = {}) => ({
  ...side('2-2'),
  slots: slots(FORMATIONS['2-2'].roles),
  opponent: { ...side('1-2-1', 66), roles: FORMATIONS['1-2-1'].roles },
  seed: 'm',
  ...over,
})
const points = (ours: Side, theirs: Side) => expectedPoints(matchOdds(ours, theirs, config), config)
const bestReply = (rival: Side, rating = 70) => [...FORMATION_IDS].sort((a, b) => points(side(b, rating), rival) - points(side(a, rating), rival))[0]

describe('expectedGoals', () => {
  it('doubles for every 20 points of attack over the other side\'s defence', () => {
    expect(expectedGoals(70, 70, config)).toBeCloseTo(2.4, 9)
    expect(expectedGoals(90, 70, config)).toBeCloseTo(4.8, 9)
    expect(expectedGoals(50, 70, config)).toBeCloseTo(1.2, 9)
  })

  it('gives two Boxes of equal players the spec\'s 1.35 goals each', () => {
    const box = side('2-2')
    expect(Math.abs(expectedGoals(box.att, box.def, config) - 1.35)).toBeLessThan(0.02)
  })

  it('rises with attack, falls with the opponent\'s defence, and is capped', () => {
    expect(expectedGoals(80, 60, config)).toBeGreaterThan(expectedGoals(70, 60, config))
    expect(expectedGoals(70, 80, config)).toBeLessThan(expectedGoals(70, 60, config))
    expect(expectedGoals(1000, 1, config)).toBe(8)
  })

  it('is nothing for a side with no attack', () => {
    expect(expectedGoals(0, 50, config)).toBe(0)
    expect(expectedGoals(0, 0, config)).toBe(0)
  })
})

describe('formations', () => {
  it('only move strength between attack and defence: ATT + DEF is the same for all of them', () => {
    for (const id of FORMATION_IDS) {
      const strength = formationStrength(id, 70)
      expect(strength.att + strength.def).toBeCloseTo(140, 9)
    }
  })

  it('make Blitz games high scoring and Wall games tight', () => {
    const goals = (id: FormationId) => matchExpectation(side(id), side(id), config).for
    expect(goals('1-1-2')).toBeGreaterThan(2)
    expect(goals('3-1')).toBeLessThan(0.5)
  })

  it('are balanced: every formation averages 2 points a match against the field', () => {
    for (const ours of FORMATION_IDS) {
      const average = FORMATION_IDS.reduce((sum, theirs) => sum + points(side(ours), side(theirs)), 0) / FORMATION_IDS.length
      expect(Math.abs(average - 2)).toBeLessThan(0.05)
    }
  })

  it('have counter-picks: the best reply depends on the rival\'s formation', () => {
    const replies = FORMATION_IDS.map(theirs => bestReply(side(theirs)))
    expect(new Set(replies).size).toBeGreaterThanOrEqual(3)
    for (const [index, theirs] of FORMATION_IDS.entries())
      expect(replies[index]).not.toBe(theirs)
  })

  it('reward defending against a stronger side and attacking a weaker one', () => {
    const fairPoints = (ours: FormationId, rating: number) =>
      FORMATION_IDS.reduce((sum, theirs) => sum + points(side(ours), side(theirs, rating)), 0)
    const best = (rating: number) => [...FORMATION_IDS].sort((a, b) => fairPoints(b, rating) - fairPoints(a, rating))[0]
    expect(['3-1', '2-1-1']).toContain(best(77))
    expect(best(63)).toBe('1-1-2')
  })

  it('never make a matchup of equal players a near-certain win', () => {
    for (const ours of FORMATION_IDS) {
      for (const theirs of FORMATION_IDS)
        expect(matchOdds(side(ours), side(theirs), config).win).toBeLessThan(0.7)
    }
  })
})

describe('tactical edges', () => {
  it('are equal and opposite', () => {
    for (const a of FORMATION_IDS) {
      expect(tacticalEdge(a, a, config)).toBe(0)
      for (const b of FORMATION_IDS)
        expect(tacticalEdge(a, b, config) + tacticalEdge(b, a, config)).toBe(0)
    }
  })

  it('cover every pair of different formations', () => {
    for (const a of FORMATION_IDS) {
      for (const b of FORMATION_IDS.filter(other => other !== a))
        expect(tacticalEdge(a, b, config)).not.toBe(0)
    }
  })

  it('are rejected from the admin when a pair is listed twice or a formation is set against itself', () => {
    const withEdges = (edges: unknown[]) => ({ ...config, formations: { edges } })
    expect(() => parseConfig(withEdges([{ formation: '3-1', over: '1-1-2', points: 5 }, { formation: '1-1-2', over: '3-1', points: 1 }]))).toThrow(/more than once/)
    expect(() => parseConfig(withEdges([{ formation: '3-1', over: '3-1', points: 5 }]))).toThrow(/itself/)
    expect(() => parseConfig(withEdges([{ formation: '4-4-2', over: '3-1', points: 5 }]))).toThrow()
    expect(parseConfig(config)).toEqual(config)
  })
})

describe('matchOdds', () => {
  it('adds up to 1', () => {
    const odds = matchOdds(side('2-2', 72), side('1-1-2', 65), config)
    expect(odds.win + odds.draw + odds.loss).toBeCloseTo(1, 9)
  })

  it('gives two equal sides equal chances of winning and losing', () => {
    const odds = matchOdds(side('1-2-1'), side('1-2-1'), config)
    expect(odds.win).toBeCloseTo(odds.loss, 9)
    expect(odds.draw).toBeGreaterThan(0.15)
  })

  it('favours the stronger side', () => {
    const odds = matchOdds(side('2-2', 80), side('2-2', 62), config)
    expect(odds.win).toBeGreaterThan(odds.loss * 3)
  })

  it('agrees with playing the match 20,000 times', () => {
    const base = input()
    const predicted = matchOdds(base, base.opponent, config)
    const tally = { win: 0, draw: 0, loss: 0 }
    for (let seed = 0; seed < 20_000; seed++)
      tally[playMatch({ ...base, seed }, config).result]++
    expect(Math.abs(tally.win / 20_000 - predicted.win)).toBeLessThan(0.012)
    expect(Math.abs(tally.draw / 20_000 - predicted.draw)).toBeLessThan(0.012)
    expect(Math.abs(tally.loss / 20_000 - predicted.loss)).toBeLessThan(0.012)
  })

  it('shows a formation\'s ATT and DEF with chemistry included once the lineup is scored', () => {
    const strength = formationStrength('2-2', 70)
    const lineup = scoreLineup('2-2', FORMATIONS['2-2'].roles.map((role, index) => ({ position: role, rating: 70, nation: index % 4 })))
    expect(strength.att).toBeCloseTo(lineup.att, 9)
  })
})

describe('bestFormation', () => {
  // A squad that can play anything: two of each outfield position and two keepers, all 70.
  const squad: PoolPlayer[] = (['GK', 'GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD', 'FWD'] as const)
    .map((position, index) => ({ id: `p${index}`, position, rating: 70, nation: index % 4 }))

  it('ranks all five formations, best reply first, each with a full lineup', () => {
    const options = bestFormation(squad, side('3-1'), config)
    expect(options.map(option => option.formation).sort()).toEqual([...FORMATION_IDS].sort())
    expect(options[0].formation).toBe(bestReply(side('3-1')))
    for (const option of options)
      expect(new Set(option.ids).size).toBe(5)
    expect(options.map(option => option.points)).toEqual([...options.map(option => option.points)].sort((a, b) => b - a))
  })

  it('is quick enough to rerun on every squad change', () => {
    const start = performance.now()
    bestFormation([...squad, ...squad.map(player => ({ ...player, id: `${player.id}b`, rating: 65 }))], side('2-2'), config)
    expect(performance.now() - start).toBeLessThan(250)
  })
})

describe('playMatch', () => {
  it('plays the same match for the same seed and a different one for another', () => {
    expect(playMatch(input(), config)).toEqual(playMatch(input(), config))
    const other = Array.from({ length: 20 }, (_, seed) => JSON.stringify(playMatch(input({ seed }), config)))
    expect(new Set(other).size).toBeGreaterThan(10)
  })

  it('reports the right result from the score', () => {
    for (let seed = 0; seed < 200; seed++) {
      const match = playMatch(input({ seed }), config)
      expect(match.result).toBe(match.goalsFor > match.goalsAgainst ? 'win' : match.goalsFor === match.goalsAgainst ? 'draw' : 'loss')
    }
  })

  it('puts every goal on the clock with a scorer, and keeps events in order', () => {
    for (let seed = 0; seed < 200; seed++) {
      const match = playMatch(input({ seed }), config)
      const goals = match.events.filter(event => event.kind === 'goal')
      expect(goals.filter(event => event.side === 'for')).toHaveLength(match.goalsFor)
      expect(goals.filter(event => event.side === 'against')).toHaveLength(match.goalsAgainst)
      for (const event of match.events) {
        expect(event.minute).toBeGreaterThanOrEqual(1)
        expect(event.minute).toBeLessThanOrEqual(90)
        expect(event.slot).toBeGreaterThanOrEqual(0)
        expect(event.slot).toBeLessThan(5)
      }
      expect(match.events.map(event => event.minute)).toEqual([...match.events.map(event => event.minute)].sort((a, b) => a - b))
    }
  })

  it('never lets our goalkeeper score', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const match = playMatch(input({ seed, att: 90 }), config)
      expect(match.events.filter(event => event.side === 'for' && event.kind === 'goal' && event.slot === 4)).toEqual([])
    }
  })

  it('scores more with the warm-up bonus: +10% ATT before the formation edge', () => {
    const base = input()
    const boosted = playMatch(input({ warmupBonus: 0.1 }), config)
    const edge = tacticalEdge(base.formation, base.opponent.formation, config)
    expect(boosted.expectedFor).toBeCloseTo(expectedGoals(base.att * 1.1 + edge, base.opponent.def - edge, config), 9)
    expect(boosted.expectedFor).toBeGreaterThan(playMatch(base, config).expectedFor)
  })

  it('does not blow up for an empty lineup', () => {
    const empty = playMatch(input({ att: 0, def: 0, slots: slots(FORMATIONS['2-2'].roles, 0) }), config)
    expect(empty.goalsFor).toBe(0)
    expect(empty.expectedAgainst).toBe(8)
    expect(empty.result).toBe('loss')
  })
})

describe('warm-up kick', () => {
  it('is +10% for gold, +5% for green and +2% for a miss', () => {
    expect([warmupBonus('gold', config), warmupBonus('green', config), warmupBonus('miss', config)]).toEqual([0.1, 0.05, 0.02])
  })
})
