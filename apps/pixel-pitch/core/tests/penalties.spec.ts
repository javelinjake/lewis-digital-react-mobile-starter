import type { PenaltyOutcome } from '../src'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, keeperAt, penaltyRounds, penaltyShot, scorePenalties, shareOf } from '../src'

const config = DEFAULT_CONFIG
const { pens } = config.minigames

/** The first millisecond after the start of a round at which a shot comes to `outcome`, or undefined. */
function tapFor(seed: string, round: number, outcome: PenaltyOutcome, from = 150, to = 12_000) {
  const rounds = penaltyRounds(seed, config)
  for (let ms = from; ms <= to; ms++) {
    if (penaltyShot(rounds[round], ms, config).outcome === outcome)
      return ms
  }
  return undefined
}

/** The shot taken at the start of a round set up so the aim and the keeper stand exactly where asked. */
function shotAt(aim: number, keeper: number) {
  // At 0 ms with a phase under 0.5 the marker sits at twice its phase; the keeper spans 0.2 to 0.8.
  const round = { aim: { speed: 1, phase: aim / 2 }, keeper: { speed: 1, phase: (keeper - 0.2) / 0.6 / 2 } }
  return penaltyShot(round, 0, config)
}

describe('penalty Shootout', () => {
  it('lays out five penalties from the seed: the same for a seed, different for another, always inside the ranges', () => {
    const rounds = penaltyRounds('club:pens:1', config)
    expect(rounds).toHaveLength(pens.rounds)
    expect(penaltyRounds('club:pens:1', config)).toEqual(rounds)
    expect(penaltyRounds('club:pens:2', config)).not.toEqual(rounds)
    for (const round of rounds) {
      expect(round.aim.speed).toBeGreaterThanOrEqual(pens.aimMinSpeed)
      expect(round.aim.speed).toBeLessThanOrEqual(pens.aimMaxSpeed)
      expect(round.keeper.speed).toBeGreaterThanOrEqual(pens.keeperMinSpeed)
      expect(round.keeper.speed).toBeLessThanOrEqual(pens.keeperMaxSpeed)
    }
  })

  it('keeps the keeper in the middle of the goal, so a corner is not always covered', () => {
    for (const round of penaltyRounds('club:pens:3', config)) {
      const positions = Array.from({ length: 5000 }, (_, ms) => keeperAt(round, ms))
      expect(Math.min(...positions)).toBeGreaterThanOrEqual(0.2 - 1e-9)
      expect(Math.max(...positions)).toBeLessThanOrEqual(0.8 + 1e-9)
    }
  })

  it('scores a shot by where it goes: wide of the posts is nothing, the keeper saves what is in reach, the corners are worth 2, the rest 1', () => {
    const { post, corner, reach } = pens
    const e = 1e-6
    // The keeper as far from the left post as they can be, so only the aim decides.
    const farRight = 0.8
    expect(shotAt(post - e, farRight)).toMatchObject({ outcome: 'wide', points: 0 })
    expect(shotAt(1 - post + e, 0.2)).toMatchObject({ outcome: 'wide', points: 0 })
    expect(shotAt(post, farRight)).toMatchObject({ outcome: 'corner', points: 2 })
    expect(shotAt(corner - e, farRight)).toMatchObject({ outcome: 'corner', points: 2 })
    expect(shotAt(1 - corner + e, 0.2)).toMatchObject({ outcome: 'corner', points: 2 })
    expect(shotAt(corner + e, farRight)).toMatchObject({ outcome: 'goal', points: 1 })
    expect(shotAt(1 - corner - e, 0.2)).toMatchObject({ outcome: 'goal', points: 1 })
    // The keeper's reach: just inside is saved, just outside is not.
    expect(shotAt(0.5, 0.5 + reach - e)).toMatchObject({ outcome: 'saved', points: 0 })
    expect(shotAt(0.5, 0.5 - reach + e)).toMatchObject({ outcome: 'saved', points: 0 })
    expect(shotAt(0.5, 0.5 + reach + e)).toMatchObject({ outcome: 'goal', points: 1 })
    // Wide beats the keeper (a wide shot is never a save), and the keeper beats the corner.
    expect(shotAt(post - e, 0.2)).toMatchObject({ outcome: 'wide', points: 0 })
    expect(shotAt(corner - e, corner)).toMatchObject({ outcome: 'saved', points: 0 })

    // The same rules hold over real rounds, and every kind of outcome comes up in each: it is a game of timing, not luck.
    // Rule breaks are collected and checked once per round: an expect per shot is ~500k assertions and times out under load.
    const points = { wide: 0, saved: 0, goal: 1, corner: 2 }
    for (let club = 0; club < 20; club++) {
      for (const round of penaltyRounds(`club:pens:${club}`, config)) {
        const seen = new Set<PenaltyOutcome>()
        const broken: unknown[] = []
        for (let ms = 150; ms < 6000; ms += 3) {
          const shot = penaltyShot(round, ms, config)
          seen.add(shot.outcome)
          const outside = shot.aim < post || shot.aim > 1 - post
          const inReach = Math.abs(shot.aim - shot.keeper) <= reach
          const inCorner = shot.aim < corner || shot.aim > 1 - corner
          const expected = outside ? 'wide' : inReach ? 'saved' : inCorner ? 'corner' : 'goal'
          if (shot.outcome !== expected || shot.points !== points[expected])
            broken.push({ club, ms, ...shot, expected })
        }
        expect(broken).toEqual([])
        expect(seen).toEqual(new Set(['wide', 'saved', 'goal', 'corner']))
      }
    }
  })

  it('pays 10 for a shootout of corners, and nothing for five wides', () => {
    const seed = 'club:pens:7'
    const corners = penaltyRounds(seed, config).map((_, round) => tapFor(seed, round, 'corner')!)
    expect(scorePenalties(seed, corners, config)).toMatchObject({ total: 10, max: 10, points: [2, 2, 2, 2, 2], outcomes: ['corner', 'corner', 'corner', 'corner', 'corner'] })
    const wides = penaltyRounds(seed, config).map((_, round) => tapFor(seed, round, 'wide')!)
    expect(scorePenalties(seed, wides, config)).toMatchObject({ total: 0 })
  })

  it('is a game of skill: a player who waits for the right moment beats one who taps at once', () => {
    let skilled = 0
    let hasty = 0
    for (let club = 0; club < 40; club++) {
      const seed = `club:pens:${club}`
      skilled += scorePenalties(seed, penaltyRounds(seed, config).map((_, round) => tapFor(seed, round, 'corner')!), config).total
      hasty += scorePenalties(seed, [200, 200, 200, 200, 200], config).total
    }
    expect(skilled / 40).toBe(10)
    expect(hasty / 40).toBeLessThan(6)
  })

  it('needs exactly one tap for each penalty', () => {
    expect(() => scorePenalties('club:pens:1', [500, 500], config)).toThrow()
  })

  it('pays tokens as a share of the best score of 10', () => {
    expect(shareOf(10, 10, 60)).toBe(60)
    expect(shareOf(4, 10, 60)).toBe(24)
  })
})
