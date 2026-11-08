import type { Fielded, PoolPlayer } from '../src'
import { createRng } from '@ld/utils/random/rng'
import { describe, expect, it } from 'vitest'
import { autoPick, chemistryBonus, FORMATION_IDS, FORMATIONS, type FormationId, positionFit, scoreLineup, upgradeDelta } from '../src'

// The worked example from the design canvas ("Lineup score · 5-a-side"): the prototype squad in a 2-2.
const VOSS: Fielded = { position: 'FWD', rating: 71, nation: 2 }
const LUND: Fielded = { position: 'MID', altPosition: 'FWD', rating: 69, nation: 0 }
const OKAFOR: Fielded = { position: 'DEF', altPosition: 'MID', rating: 67, nation: 1 }
const SATO: Fielded = { position: 'MID', rating: 50, nation: 1 }
const DUARTE: Fielded = { position: 'DEF', rating: 59, nation: 0 }
const BRAKE: Fielded = { position: 'GK', rating: 58, nation: 0 }

describe('position fit', () => {
  it('is 100% in the main position and 90% in the secondary', () => {
    expect(positionFit({ position: 'DEF' }, 'DEF')).toBe(1)
    expect(positionFit({ position: 'MID', altPosition: 'FWD' }, 'FWD')).toBe(0.9)
  })

  it('is 75% one line away and 55% two or more lines away', () => {
    expect(positionFit({ position: 'MID' }, 'DEF')).toBe(0.75)
    expect(positionFit({ position: 'DEF' }, 'MID')).toBe(0.75)
    expect(positionFit({ position: 'DEF' }, 'FWD')).toBe(0.55)
    expect(positionFit({ position: 'FWD' }, 'DEF')).toBe(0.55)
  })

  it('is 30% for an outfielder in goal or a goalkeeper outfield', () => {
    expect(positionFit({ position: 'FWD' }, 'GK')).toBe(0.3)
    expect(positionFit({ position: 'DEF', altPosition: 'MID' }, 'GK')).toBe(0.3)
    expect(positionFit({ position: 'GK' }, 'DEF')).toBe(0.3)
  })
})

describe('formations', () => {
  it('has five formations of five slots, each with one goalkeeper', () => {
    expect(FORMATION_IDS).toEqual(['2-2', '1-2-1', '2-1-1', '3-1', '1-1-2'])
    for (const id of FORMATION_IDS) {
      expect(FORMATIONS[id].roles).toHaveLength(5)
      expect(FORMATIONS[id].roles.filter(role => role === 'GK')).toHaveLength(1)
    }
  })

  it('splits five 70s into ATT and DEF that always add up to 140', () => {
    const fiveSeventies = (id: FormationId) => scoreLineup(id, FORMATIONS[id].roles.map((role, index): Fielded => ({ position: role, rating: 70, nation: index % 4 })))
    const rounded = (id: FormationId) => [Math.round(fiveSeventies(id).att), Math.round(fiveSeventies(id).def)]
    expect(rounded('2-2')).toEqual([62, 78])
    expect(rounded('1-2-1')).toEqual([59, 81])
    expect(rounded('2-1-1')).toEqual([50, 90])
    expect(rounded('3-1')).toEqual([42, 98])
    expect(rounded('1-1-2')).toEqual([70, 70])
  })
})

describe('scoreLineup: the canvas\'s worked example', () => {
  it('scores the prototype squad 59 with SATO out of position', () => {
    const score = scoreLineup('2-2', [VOSS, LUND, OKAFOR, SATO, BRAKE])
    expect(score.slots.map(slot => slot.score)).toEqual([71, 69 * 0.9, 67, 37.5, 58])
    expect(score.average).toBeCloseTo(59.12, 2)
    expect(score.chemistry).toBe(0)
    expect(score.overall).toBe(59)
  })

  it('costs 12.5 points to play SATO at the back', () => {
    expect(SATO.rating - scoreLineup('2-2', [VOSS, LUND, OKAFOR, SATO, BRAKE]).slots[3].score).toBe(12.5)
  })

  it('scores 65 with DUARTE in at defence, three Northvale players linking up for +3%', () => {
    const score = scoreLineup('2-2', [VOSS, LUND, OKAFOR, DUARTE, BRAKE])
    expect(score.average).toBeCloseTo(63.42, 2)
    expect(score.chemistry).toBe(0.03)
    expect(score.overall).toBe(65)
  })
})

describe('chemistry', () => {
  it('is +3% for three from one nation, +5% for four, +8% for all five, and nothing below three', () => {
    expect([0, 1, 2, 3, 4, 5].map(chemistryBonus)).toEqual([0, 0, 0, 0.03, 0.05, 0.08])
  })

  it('multiplies the score, ATT and DEF together', () => {
    const squad = (nation: (i: number) => number) => [VOSS, LUND, OKAFOR, DUARTE, BRAKE].map((p, i) => ({ ...p, nation: nation(i) }))
    const none = scoreLineup('2-2', squad(i => i % 4))
    const all = scoreLineup('2-2', squad(() => 1))
    expect(all.chemistry).toBe(0.08)
    expect(all.exact / none.exact).toBeCloseTo(1.08, 5)
    expect(all.att / none.att).toBeCloseTo(1.08, 5)
    expect(all.def / none.def).toBeCloseTo(1.08, 5)
  })
})

describe('an unfilled lineup', () => {
  it('scores empty slots as zero instead of failing', () => {
    const score = scoreLineup('2-2', [VOSS, null, null, null, null])
    expect(score.slots.map(slot => slot.score)).toEqual([71, 0, 0, 0, 0])
    expect(score.overall).toBe(14)
  })
})

describe('autoPick', () => {
  const pool = (players: Fielded[]): PoolPlayer[] => players.map((player, index) => ({ ...player, id: `c${index}` }))

  it('finds a lineup at least as good as the canvas\'s hand-picked one', () => {
    const result = autoPick('2-2', pool([VOSS, LUND, OKAFOR, SATO, DUARTE, BRAKE]))
    expect(result.exact).toBeGreaterThanOrEqual(65.3)
    expect(result.ids).toHaveLength(5)
    expect(result.ids[4]).toBe('c5')
    expect(result.ids).not.toContain('c3')
  })

  it('always finds the true best: it matches an exhaustive search made with scoreLineup', () => {
    const rng = createRng('auto-pick-reference')
    const permutations = <T>(items: T[], size: number): T[][] => size === 0
      ? [[]]
      : items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)], size - 1).map(rest => [item, ...rest]))

    for (let run = 0; run < 12; run++) {
      const squad = pool(Array.from({ length: 8 }, () => ({
        position: rng.pick(['GK', 'DEF', 'MID', 'FWD'] as const),
        altPosition: rng.next() < 0.4 ? rng.pick(['DEF', 'MID', 'FWD'] as const) : undefined,
        rating: rng.int(44, 94),
        nation: rng.int(0, 3),
      })))
      const formation = rng.pick(FORMATION_IDS)
      const best = Math.max(...permutations(squad, 5).map(lineup => scoreLineup(formation, lineup).exact))
      expect(autoPick(formation, squad).exact).toBeCloseTo(best, 9)
    }
  })

  it('puts a goalkeeper in goal even when he is the lowest rated in the squad', () => {
    const squad = pool([
      { position: 'FWD', rating: 90, nation: 0 },
      { position: 'FWD', rating: 88, nation: 1 },
      { position: 'DEF', rating: 85, nation: 2 },
      { position: 'DEF', rating: 84, nation: 3 },
      { position: 'MID', rating: 83, nation: 0 },
      { position: 'MID', rating: 82, nation: 1 },
      { position: 'DEF', rating: 81, nation: 2 },
      { position: 'FWD', rating: 80, nation: 3 },
      { position: 'MID', rating: 79, nation: 0 },
      { position: 'MID', rating: 78, nation: 1 },
      { position: 'DEF', rating: 77, nation: 2 },
      { position: 'FWD', rating: 76, nation: 3 },
      { position: 'GK', rating: 45, nation: 0 },
    ])
    const result = autoPick('2-2', squad)
    expect(result.ids[4]).toBe('c12')
  })

  it('copes with fewer than five players', () => {
    expect(autoPick('2-2', pool([VOSS, BRAKE])).ids).toHaveLength(2)
    expect(autoPick('2-2', [])).toEqual({ ids: [], exact: 0 })
  })

  it('is fast: under 50ms for a big squad', () => {
    const rng = createRng(1)
    const squad = pool(Array.from({ length: 25 }, () => ({ position: rng.pick(['GK', 'DEF', 'MID', 'FWD'] as const), rating: rng.int(44, 94), nation: rng.int(0, 3) })))
    const started = performance.now()
    autoPick('1-2-1', squad)
    expect(performance.now() - started).toBeLessThan(50)
  })
})

describe('upgradeDelta', () => {
  const lineup = [VOSS, LUND, OKAFOR, SATO, BRAKE]

  it('finds the slot a better player would help most, and by how much', () => {
    const striker: Fielded = { position: 'DEF', rating: 80, nation: 3 }
    const result = upgradeDelta('2-2', lineup, striker)
    expect(result.slot).toBe(3)
    expect(result.delta).toBeGreaterThan(0)
  })

  it('says a weaker player is no upgrade', () => {
    expect(upgradeDelta('2-2', lineup, { position: 'FWD', rating: 40, nation: 3 })).toEqual({ delta: 0, slot: null })
  })

  it('treats an empty slot as a place any player improves', () => {
    expect(upgradeDelta('2-2', [VOSS, null, null, null, null], DUARTE).delta).toBeGreaterThan(0)
  })
})
