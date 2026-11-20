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
    for (let club = 0; club < 20; club++) {
      const rounds = penaltyRounds(`club:pens:${club}`, config)
      for (const round of rounds) {
        const seen = new Set<PenaltyOutcome>()
        for (let ms = 150; ms < 6000; ms += 3) {
          const shot = penaltyShot(round, ms, config)
          seen.add(shot.outcome)
          const expected = { wide: 0, saved: 0, goal: 1, corner: 2 }[shot.outcome]
          expect(shot.points).toBe(expected)
          if (shot.outcome === 'wide')
            expect(shot.aim < pens.post || shot.aim > 1 - pens.post).toBe(true)
          if (shot.outcome === 'saved')
            expect(Math.abs(shot.aim - shot.keeper)).toBeLessThanOrEqual(pens.reach)
          if (shot.outcome === 'corner')
            expect(shot.aim < pens.corner || shot.aim > 1 - pens.corner).toBe(true)
        }
        // Every kind of outcome comes up over a round: it is a game of timing, not luck.
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
