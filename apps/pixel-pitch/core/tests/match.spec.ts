import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, expectedGoals, FORMATION_IDS, FORMATIONS, formationStrength, playMatch, type Position, scoreLineup, warmupBonus, winProbabilities } from '../src'

const config = DEFAULT_CONFIG
const slots = (roles: readonly Position[], score = 70) => roles.map(role => ({ role, score }))
const input = (over = {}) => ({
  att: 70,
  def: 62,
  slots: slots(FORMATIONS['2-2'].roles),
  opponent: { att: 65, def: 60, roles: FORMATIONS['1-2-1'].roles as readonly Position[] },
  seed: 'm',
  ...over,
})

describe('expectedGoals', () => {
  it('is 1.35 × (ATT ÷ their DEF)²', () => {
    expect(expectedGoals(77, 65.33, config)).toBeCloseTo(1.35 * (77 / 65.33) ** 2, 6)
    expect(expectedGoals(60, 60, config)).toBeCloseTo(1.35, 6)
  })

  it('rises with attack, falls with the opponent\'s defence, and is capped', () => {
    expect(expectedGoals(80, 60, config)).toBeGreaterThan(expectedGoals(70, 60, config))
    expect(expectedGoals(70, 80, config)).toBeLessThan(expectedGoals(70, 60, config))
    expect(expectedGoals(1000, 1, config)).toBe(8)
  })

  it('concedes the most to a side with no defence, and nothing when neither side has any play', () => {
    expect(expectedGoals(50, 0, config)).toBe(8)
    expect(expectedGoals(0, 0, config)).toBe(0)
  })
})

describe('winProbabilities', () => {
  it('adds up to 1', () => {
    const odds = winProbabilities(70, 60, 65, 62, config)
    expect(odds.win + odds.draw + odds.loss).toBeCloseTo(1, 9)
  })

  it('gives two equal sides equal chances of winning and losing', () => {
    const odds = winProbabilities(65, 65, 65, 65, config)
    expect(odds.win).toBeCloseTo(odds.loss, 9)
    expect(odds.draw).toBeGreaterThan(0.15)
  })

  it('favours the stronger side', () => {
    const odds = winProbabilities(80, 70, 55, 55, config)
    expect(odds.win).toBeGreaterThan(odds.loss * 3)
  })

  it('changes with the formation, so the choice has an effect', () => {
    const opponent = formationStrength('1-2-1', 70)
    const wins = FORMATION_IDS.map((id) => {
      const mine = formationStrength(id, 70)
      return winProbabilities(mine.att, mine.def, opponent.att, opponent.def, config).win
    })
    expect(Math.max(...wins) - Math.min(...wins)).toBeGreaterThan(0.05)
  })

  // OPEN DESIGN ISSUE. The canvas says to switch to a Wall against a high-ATT side and a Blitz against a high-DEF one.
  // With the formulas as specified that does not happen: ATT = Σ/2 and DEF = Σ/3 give formations different totals
  // (five 70s: Blitz 146, Box 142, Pyramid 138, Wall 135), so a Blitz is the best reply to almost every opponent and a
  // Wall to none. Equalising the totals brings back a choice, but a weak one (1 to 2 points of win chance).
  // See docs/games.md. Turn this into a real test once the model is decided.
  it.todo('has a counter-pick: a different formation is the best reply to different opponents')

  it('agrees with playing the match 20,000 times', () => {
    const base = input()
    const predicted = winProbabilities(base.att, base.def, base.opponent.att, base.opponent.def, config)
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

  it('scores more with the warm-up bonus', () => {
    const plain = playMatch(input(), config)
    const boosted = playMatch(input({ warmupBonus: 0.1 }), config)
    expect(boosted.expectedFor).toBeCloseTo(plain.expectedFor * 1.21, 6)
  })

  it('does not blow up for an empty lineup', () => {
    const empty = playMatch(input({ att: 0, def: 0, slots: slots(FORMATIONS['2-2'].roles, 0) }), config)
    expect(empty.goalsFor).toBe(0)
    expect(empty.goalsAgainst).toBeGreaterThan(0)
    expect(empty.result).toBe('loss')
  })
})

describe('warm-up kick', () => {
  it('is +10% for gold, +5% for green and +2% for a miss', () => {
    expect([warmupBonus('gold', config), warmupBonus('green', config), warmupBonus('miss', config)]).toEqual([0.1, 0.05, 0.02])
  })

  it('works for every formation', () => {
    for (const id of FORMATION_IDS)
      expect(formationStrength(id, 60).att).toBeGreaterThan(0)
  })
})
