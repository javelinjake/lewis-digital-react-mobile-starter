import type { PenaltyOutcome } from '../src'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, isGameRuleError, keeperAt, keeperReaches, penaltyBallAt, penaltyRounds, penaltyShot, perfectTaps, scorePenalties, scorePlay, shareOf } from '../src'

const config = DEFAULT_CONFIG
const { pens } = config.minigames

/** The first millisecond after the start of a round at which a shot comes to `outcome`, or undefined. */
function tapFor(seed: string, round: number, outcome: PenaltyOutcome, from = 150, to = 30_000) {
  const rounds = penaltyRounds(seed, config)
  for (let ms = from; ms <= to; ms++) {
    if (penaltyShot(rounds[round], ms, config).outcome === outcome)
      return ms
  }
  return undefined
}

describe('penalty Shootout', () => {
  it('lays out five penalties from the seed: the same for a seed, different for another', () => {
    const rounds = penaltyRounds('club:pens:1', config)
    expect(rounds).toHaveLength(pens.rounds)
    expect(penaltyRounds('club:pens:1', config)).toEqual(rounds)
    expect(penaltyRounds('club:pens:2', config)).not.toEqual(rounds)
    for (const round of rounds) {
      expect(round.ball.x).toHaveLength(pens.aimPoints)
      expect(round.keeper.x).toHaveLength(pens.keeperPoints)
    }
    // Each round is quicker than the one before: its loop is shorter for the same number of points.
    expect(rounds.at(-1)!.ball.loopMs).toBeLessThan(rounds[0].ball.loopMs * 0.95)
  })

  it('moves the ball smoothly about the goal and around it, over the bar and wide of both posts', () => {
    let over = false
    let left = false
    let right = false
    let biggestStep = 0
    let outside = 0
    for (let club = 0; club < 10; club++) {
      for (const round of penaltyRounds(`club:pens:${club}`, config)) {
        let last = penaltyBallAt(round, 0, config)
        for (let ms = 1; ms < round.ball.loopMs * 2; ms += 2) {
          const ball = penaltyBallAt(round, ms, config)
          biggestStep = Math.max(biggestStep, Math.abs(ball.x - last.x) + Math.abs(ball.y - last.y))
          if (ball.x < -pens.wide || ball.x > pens.goalWidth + pens.wide || ball.y < pens.ballRadius || ball.y > pens.goalHeight + pens.over)
            outside++
          over ||= ball.y > pens.goalHeight
          left ||= ball.x < 0
          right ||= ball.x > pens.goalWidth
          last = ball
        }
        // It loops: a loop later, it is where it was.
        expect(penaltyBallAt(round, 1234 + round.ball.loopMs, config)).toEqual(penaltyBallAt(round, 1234, config))
      }
    }
    // No jumps: a few units at most in 2 ms, and never outside the area it wanders in.
    expect(biggestStep).toBeLessThan(3)
    expect(outside).toBe(0)
    expect({ over, left, right }).toEqual({ over: true, left: true, right: true })
  })

  it('keeps the keeper in the middle of the goal, moving both ways at changing speeds', () => {
    for (const round of penaltyRounds('club:pens:3', config)) {
      const positions = Array.from({ length: 8000 }, (_, ms) => keeperAt(round, ms))
      expect(Math.min(...positions)).toBeGreaterThanOrEqual(pens.keeperMin - 1e-9)
      expect(Math.max(...positions)).toBeLessThanOrEqual(pens.keeperMax + 1e-9)
      const steps = positions.slice(1).map((x, ms) => x - positions[ms])
      expect(steps.some(step => step > 0.01)).toBe(true)
      expect(steps.some(step => step < -0.01)).toBe(true)
    }
  })

  it('scores a shot by where the ball is: wide or over is nothing, the keeper saves what is in reach, a corner is 2, the rest 1', () => {
    const wrong: string[] = []
    for (let club = 0; club < 20; club++) {
      const rounds = penaltyRounds(`club:pens:${club}`, config)
      for (const [index, round] of rounds.entries()) {
        const seen = new Set<PenaltyOutcome>()
        for (let ms = 150; ms < round.ball.loopMs + 150; ms += 3) {
          const shot = penaltyShot(round, ms, config)
          seen.add(shot.outcome)
          const ball = penaltyBallAt(round, ms, config)
          const inside = shot.x >= 0 && shot.x <= pens.goalWidth
          const reached = keeperReaches(shot.keeper, shot, config)
          const right = shot.x === ball.x && shot.y === ball.y && shot.keeper === keeperAt(round, ms)
            && shot.points === { wide: 0, over: 0, saved: 0, goal: 1, corner: 2 }[shot.outcome]
            && (shot.outcome !== 'wide' || !inside)
            && (shot.outcome !== 'over' || (inside && shot.y > pens.goalHeight))
            && (shot.outcome !== 'saved' || reached)
            && ((shot.outcome !== 'corner' && shot.outcome !== 'goal') || (inside && shot.y <= pens.goalHeight && !reached))
            && (shot.outcome !== 'corner' || shot.x <= pens.cornerWidth || shot.x >= pens.goalWidth - pens.cornerWidth)
          if (!right)
            wrong.push(`${club}/${index}@${ms}: ${JSON.stringify(shot)}`)
        }
        // A goal and a corner come round in every penalty: it is a game of timing, not luck.
        if (!seen.has('corner') || !seen.has('goal'))
          wrong.push(`${club}/${index}: only ${[...seen].join(', ')}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('saves a shot at the keeper, and misses one over the bar or wide, whoever is in goal', () => {
    const keeper = 50
    expect(keeperReaches(keeper, { x: 50, y: 20 }, config)).toBe(true)
    expect(keeperReaches(keeper, { x: 50 + pens.reachX - 1, y: pens.reachMid }, config)).toBe(true)
    expect(keeperReaches(keeper, { x: 50 + pens.reachX + 1, y: pens.reachMid }, config)).toBe(false)
    expect(keeperReaches(keeper, { x: 4, y: 36 }, config)).toBe(false)
    const seed = 'club:pens:5'
    const rounds = penaltyRounds(seed, config)
    for (const outcome of ['over', 'wide', 'saved'] as const) {
      const tap = tapFor(seed, 0, outcome)!
      expect(tap, outcome).toBeDefined()
      expect(penaltyShot(rounds[0], tap, config)).toMatchObject({ outcome, points: 0 })
    }
  })

  it('pays 10 for a perfect shootout, the same once the taps have been through JSON, and nothing for five over the bar', () => {
    for (let club = 0; club < 60; club++) {
      const seed = `club:pens:${club}`
      const taps = perfectTaps('pens', seed, config)
      expect(scorePenalties(seed, taps, config)).toMatchObject({ total: 10, max: 10, points: [2, 2, 2, 2, 2], outcomes: ['corner', 'corner', 'corner', 'corner', 'corner'] })
      expect(scorePlay('pens', seed, JSON.parse(JSON.stringify(taps)), config).score).toBe(10)
    }
    const seed = 'club:pens:7'
    const overs = penaltyRounds(seed, config).map((_, round) => tapFor(seed, round, 'over')!)
    expect(scorePenalties(seed, overs, config)).toMatchObject({ total: 0, outcomes: ['over', 'over', 'over', 'over', 'over'] })
  })

  it('is a game of skill: a player who waits for the right moment beats one who taps at once', () => {
    let skilled = 0
    let hasty = 0
    for (let club = 0; club < 40; club++) {
      const seed = `club:pens:${club}`
      skilled += scorePenalties(seed, perfectTaps('pens', seed, config), config).total
      hasty += scorePenalties(seed, [200, 200, 200, 200, 200], config).total
    }
    expect(skilled / 40).toBe(10)
    expect(hasty / 40).toBeLessThan(5)
  })

  it('needs exactly one tap for each penalty, none quicker than a person', () => {
    expect(() => scorePenalties('club:pens:1', [500, 500], config)).toThrow()
    const refused = (taps: unknown) => {
      try {
        scorePlay('pens', 'club:pens:1', taps, config)
        return false
      }
      catch (error) {
        return isGameRuleError(error) && error.code === 'taps'
      }
    }
    expect(refused([5, 500, 500, 500, 500])).toBe(true)
    expect(refused([500, 500])).toBe(true)
    expect(refused([{ ms: 500 }, 500, 500, 500, 500])).toBe(true)
  })

  it('pays tokens as a share of the best score of 10', () => {
    expect(shareOf(10, 10, 60)).toBe(60)
    expect(shareOf(4, 10, 60)).toBe(24)
  })
})
