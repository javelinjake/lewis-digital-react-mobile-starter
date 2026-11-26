import type { Cabinet, LaneMove } from '../src'
import { describe, expect, it } from 'vitest'
import { ballSlot, cabinetMax, CABINETS, coneRound, defenderProgress, defendersBeaten, DEFAULT_CONFIG, DIVE_SIDES, dribbleEndMs, dribbleRun, dribbleTackle, hitsTarget, isGameRuleError, keeperOutcome, keeperShots, laneAt, passLength, passSequence, perfectTaps, scoreCones, scoreDribble, scoreKeeper, scorePass, scorePlay, scoreTargets, startLane, targetSpots } from '../src'

const config = DEFAULT_CONFIG
const games = config.minigames
const seeds = Array.from({ length: 60 }, (_, index) => `club:game:${index}`)
const code = (run: () => unknown) => {
  try {
    run()
    return 'accepted'
  }
  catch (error) {
    return isGameRuleError(error) ? error.code : 'other'
  }
}

describe('every cabinet', () => {
  it('can be played perfectly, scoring its top score, and the score is the same after the trip through JSON', () => {
    for (const cabinet of CABINETS) {
      for (const seed of seeds.slice(0, 10)) {
        const taps = perfectTaps(cabinet, seed, config)
        const result = scorePlay(cabinet, seed, JSON.parse(JSON.stringify(taps)), config)
        expect(result, `${cabinet} ${seed}`).toMatchObject({ score: cabinetMax(cabinet, config), max: cabinetMax(cabinet, config) })
        expect(result.playMs).toBeGreaterThan(0)
      }
    }
  })

  it('refuses something that is not a list of taps', () => {
    for (const cabinet of CABINETS) {
      expect(code(() => scorePlay(cabinet, 's', 'lots', config))).toBe('taps')
      expect(code(() => scorePlay(cabinet, 's', [{ evil: true }], config))).toBe('taps')
    }
  })

  it('has a top score for each', () => {
    expect(Object.fromEntries(CABINETS.map(cabinet => [cabinet, cabinetMax(cabinet, config)]))).toEqual({ kick: 27, keepy: 33, pens: 10, keeper: 10, pass: 8, dribble: 32, targets: 15, cones: 5 })
  })
})

describe('Keeper Reflex', () => {
  const { shots, minDelayMs, maxDelayMs, firstWindowMs, lastWindowMs, minReactionMs } = games.keeper

  it('has ten shots, the same for a seed, with less time to dive on each', () => {
    const all = keeperShots('a', config)
    expect(all).toHaveLength(shots)
    expect(keeperShots('a', config)).toEqual(all)
    expect(keeperShots('b', config)).not.toEqual(all)
    for (let index = 1; index < all.length; index++)
      expect(all[index].windowMs).toBeLessThan(all[index - 1].windowMs)
    expect(all[0].windowMs).toBe(firstWindowMs)
    expect(all.at(-1)!.windowMs).toBe(lastWindowMs)
  })

  it('shoots at every side over many games, after a wait that cannot be anticipated', () => {
    const all = seeds.flatMap(seed => keeperShots(seed, config))
    expect(new Set(all.map(shot => shot.side))).toEqual(new Set(DIVE_SIDES))
    expect(Math.min(...all.map(shot => shot.delayMs))).toBeGreaterThanOrEqual(minDelayMs)
    expect(Math.max(...all.map(shot => shot.delayMs))).toBeLessThanOrEqual(maxDelayMs)
    expect(new Set(all.map(shot => shot.delayMs)).size).toBeGreaterThan(100)
  })

  it('saves a dive the right way in time; diving early, the wrong way or too late is a goal', () => {
    const [shot] = keeperShots('c', config)
    const other = DIVE_SIDES.find(side => side !== shot.side)!
    expect(keeperOutcome(shot, { side: shot.side, ms: shot.delayMs + 200 }, config)).toBe('saved')
    expect(keeperOutcome(shot, { side: other, ms: shot.delayMs + 200 }, config)).toBe('wrong')
    expect(keeperOutcome(shot, { side: shot.side, ms: shot.delayMs - 50 }, config)).toBe('early')
    // Quicker than anyone can react is a guess.
    expect(keeperOutcome(shot, { side: shot.side, ms: shot.delayMs + minReactionMs - 1 }, config)).toBe('early')
    expect(keeperOutcome(shot, { side: shot.side, ms: shot.delayMs + shot.windowMs + 1 }, config)).toBe('late')
    expect(keeperOutcome(shot, null, config)).toBe('late')
  })

  it('scores the saves, and needs a dive (or none) for every shot', () => {
    const all = keeperShots('d', config)
    const dives = all.map((shot, index) => (index % 2 === 0 ? { side: shot.side, ms: shot.delayMs + 250 } : null))
    expect(scoreKeeper('d', dives, config)).toMatchObject({ total: 5, max: 10 })
    expect(code(() => scorePlay('keeper', 'd', dives.slice(1), config))).toBe('taps')
    expect(code(() => scorePlay('keeper', 'd', dives.map(() => ({ side: 'up', ms: 900 })), config))).toBe('taps')
  })
})

describe('Pass Master', () => {
  const { players, start, rounds } = games.pass

  it('is one move that grows a pass a round, among four players, never to the same player twice running', () => {
    for (const seed of seeds) {
      const sequence = passSequence(seed, config)
      expect(sequence).toHaveLength(start + rounds - 1)
      expect(passSequence(seed, config)).toEqual(sequence)
      for (const [index, player] of sequence.entries()) {
        expect(player).toBeGreaterThanOrEqual(0)
        expect(player).toBeLessThan(players)
        if (index > 0)
          expect(player).not.toBe(sequence[index - 1])
      }
    }
    expect(new Set(seeds.map(seed => passSequence(seed, config).join())).size).toBeGreaterThan(50)
  })

  it('counts the rounds repeated exactly, up to the first mistake, which ends the play', () => {
    const sequence = passSequence('e', config)
    const right = (round: number) => sequence.slice(0, passLength(round, config))
    const wrong = [...right(2).slice(0, 1), (right(2)[1] + 1) % players]
    expect(scorePass('e', [right(0), right(1), wrong], config).total).toBe(2)
    expect(scorePass('e', [right(0), right(1)], config).total).toBe(2)
    expect(scorePass('e', [], config).total).toBe(0)
    // Nothing may follow a wrong round, and a round is not right with a pass missing.
    expect(code(() => scorePlay('pass', 'e', [right(0), wrong, right(2)], config))).toBe('taps')
    expect(scorePass('e', [right(0).slice(0, -1)], config).total).toBe(0)
    expect(code(() => scorePlay('pass', 'e', [[0, players]], config))).toBe('taps')
  })

  it('takes at least as long as it takes to show each move', () => {
    const sequence = passSequence('f', config)
    const { playMs } = scorePass('f', [sequence.slice(0, start)], config)
    expect(playMs).toBeGreaterThanOrEqual(start * games.pass.showMs)
  })
})

describe('Dribble Dash', () => {
  const { lanes, defenders, tackleFrom, tackleTo } = games.dribble

  it('sends a set number of defenders down the lanes, closer together and faster as it goes', () => {
    const run = dribbleRun('a', config)
    expect(dribbleRun('a', config)).toEqual(run)
    expect(run).toHaveLength(defenders)
    expect(run.every(defender => defender.lane >= 0 && defender.lane < lanes)).toBe(true)
    expect(run[1].atMs - run[0].atMs).toBeGreaterThan(run.at(-1)!.atMs - run.at(-2)!.atMs)
    expect(run[0].fallMs).toBeGreaterThan(run.at(-1)!.fallMs)
    expect(dribbleEndMs(run)).toBeLessThan(30_000)
  })

  it('never puts three in a row in one lane, and can always be survived', () => {
    for (const seed of seeds) {
      const run = dribbleRun(seed, config)
      for (let index = 2; index < run.length; index++)
        expect(run[index].lane === run[index - 1].lane && run[index].lane === run[index - 2].lane).toBe(false)
      // Only one defender can tackle at any moment, so there is always a free lane next to it.
      for (let ms = 0; ms < dribbleEndMs(run); ms += 10) {
        const inRange = run.filter((defender) => {
          const progress = defenderProgress(defender, ms)
          return progress >= tackleFrom && progress <= tackleTo
        })
        expect(inRange.length, `${seed} at ${ms}`).toBeLessThanOrEqual(1)
      }
      expect(scoreDribble(seed, perfectTaps('dribble', seed, config), config)).toMatchObject({ total: defenders, tackled: false })
    }
  })

  it('tackles a player who stands still in a defender\'s lane, and counts those already beaten', () => {
    const seed = seeds.find(candidate => dribbleRun(candidate, config)[0].lane === startLane(config))!
    const run = dribbleRun(seed, config)
    const first = run[0]
    // Standing still in the middle lane: the first defender down it tackles.
    expect(dribbleTackle(run, [], config)).toEqual({ index: 0, atMs: first.atMs + first.fallMs * tackleFrom })
    expect(scoreDribble(seed, [], config)).toMatchObject({ total: 0, tackled: true })
    expect(defendersBeaten(run, 0, config)).toBe(0)
    expect(defendersBeaten(run, first.atMs + first.fallMs, config)).toBeGreaterThanOrEqual(1)
  })

  it('tackles a player who moves into a defender\'s lane while it can tackle', () => {
    const seed = seeds.find(candidate => dribbleRun(candidate, config)[0].lane === 0)!
    const run = dribbleRun(seed, config)
    const first = run[0]
    const meet = Math.round(first.atMs + first.fallMs * (tackleFrom + tackleTo) / 2)
    const moves: LaneMove[] = [{ ms: meet, lane: 0 }]
    expect(laneAt(moves, meet - 1, config)).toBe(startLane(config))
    expect(dribbleTackle(run, moves, config)).toEqual({ index: 0, atMs: meet })
    // Looking only up to a moment before the move, there is no tackle yet: the phone sees what the server will.
    expect(dribbleTackle(run, moves, config, meet - 1)).toBeNull()
  })

  it('refuses a move of two lanes at once, out of the pitch, or quicker than a person', () => {
    expect(code(() => scorePlay('dribble', 'a', [{ ms: 1000, lane: 3 }], config))).toBe('taps')
    expect(code(() => scorePlay('dribble', 'a', [{ ms: 1000, lane: 0 }, { ms: 1500, lane: 2 }], config))).toBe('taps')
    expect(code(() => scorePlay('dribble', 'a', [{ ms: 1000, lane: 0 }, { ms: 1010, lane: 1 }], config))).toBe('taps')
    expect(code(() => scorePlay('dribble', 'a', [{ ms: 1000, lane: 0 }, { ms: 1500, lane: 1 }], config))).toBe('accepted')
  })
})

describe('Target Practice', () => {
  const { count, width, height, margin, minJump, hitRadius } = games.targets

  it('shows fifteen targets inside the goal, each for less time, each well away from the last', () => {
    for (const seed of seeds) {
      const spots = targetSpots(seed, config)
      expect(spots).toHaveLength(count)
      for (const [index, spot] of spots.entries()) {
        expect(spot.x).toBeGreaterThanOrEqual(margin)
        expect(spot.x).toBeLessThanOrEqual(width - margin)
        expect(spot.y).toBeGreaterThanOrEqual(margin)
        expect(spot.y).toBeLessThanOrEqual(height - margin)
        if (index > 0) {
          expect(spot.lifeMs).toBeLessThan(spots[index - 1].lifeMs)
          expect(Math.hypot(spot.x - spots[index - 1].x, spot.y - spots[index - 1].y)).toBeGreaterThanOrEqual(minJump)
        }
      }
    }
    expect(targetSpots('a', config)).toEqual(targetSpots('a', config))
  })

  it('hits a target tapped on (within a forgiving circle) before it goes, and misses one tapped wide or late', () => {
    const [target] = targetSpots('b', config)
    expect(hitsTarget(target, { ms: 300, x: target.x, y: target.y }, config)).toBe(true)
    expect(hitsTarget(target, { ms: 300, x: target.x + hitRadius - 1, y: target.y }, config)).toBe(true)
    expect(hitsTarget(target, { ms: 300, x: target.x + hitRadius + 1, y: target.y }, config)).toBe(false)
    expect(hitsTarget(target, { ms: target.lifeMs + 1, x: target.x, y: target.y }, config)).toBe(false)
    expect(hitsTarget(target, null, config)).toBe(false)
  })

  it('scores the hits, and refuses a tap quicker than a person could make', () => {
    const spots = targetSpots('c', config)
    const taps = spots.map((spot, index) => (index < 5 ? { ms: 400, x: spot.x, y: spot.y } : null))
    expect(scoreTargets('c', taps, config)).toMatchObject({ total: 5, max: count })
    expect(code(() => scorePlay('targets', 'c', taps.map(tap => tap && { ...tap, ms: 20 }), config))).toBe('taps')
    expect(code(() => scorePlay('targets', 'c', taps.slice(2), config))).toBe('taps')
  })
})

describe('Cone Shuffle', () => {
  const { cones, rounds, firstSwaps, swapsPerRound } = games.cones

  it('swaps more, and quicker, every round, always two different cones', () => {
    for (const seed of seeds) {
      for (let round = 0; round < rounds; round++) {
        const layout = coneRound(seed, round, config)
        expect(layout.swaps).toHaveLength(firstSwaps + round * swapsPerRound)
        expect(layout.ball).toBeGreaterThanOrEqual(0)
        expect(layout.ball).toBeLessThan(cones)
        for (const [a, b] of layout.swaps) {
          expect(a).not.toBe(b)
          expect(Math.max(a, b)).toBeLessThan(cones)
        }
        if (round > 0)
          expect(layout.swapMs).toBeLessThan(coneRound(seed, round - 1, config).swapMs)
      }
    }
  })

  it('follows the ball through the swaps', () => {
    expect(ballSlot({ ball: 0, swaps: [] })).toBe(0)
    expect(ballSlot({ ball: 0, swaps: [[0, 2]] })).toBe(2)
    expect(ballSlot({ ball: 0, swaps: [[1, 2]] })).toBe(0)
    expect(ballSlot({ ball: 1, swaps: [[1, 0], [0, 2], [2, 1]] })).toBe(1)
    // The ball ends in every slot over many games: there is nothing to guess from.
    expect(new Set(seeds.map(seed => ballSlot(coneRound(seed, rounds - 1, config))))).toEqual(new Set([0, 1, 2]))
  })

  it('scores the right picks, one for each round', () => {
    const right = perfectTaps('cones', 'g', config)
    const two = right.map((slot, round) => (round < 2 ? slot : (slot + 1) % cones))
    expect(scoreCones('g', two, config)).toMatchObject({ total: 2, max: rounds })
    expect(code(() => scorePlay('cones', 'g', two.slice(1), config))).toBe('taps')
    expect(code(() => scorePlay('cones', 'g', two.map(() => cones), config))).toBe('taps')
  })
})

describe('the new cabinets', () => {
  it('are in the arcade with the first three', () => {
    const fresh: Cabinet[] = ['keeper', 'pass', 'dribble', 'targets', 'cones']
    expect(CABINETS).toEqual(expect.arrayContaining([...fresh, 'kick', 'keepy', 'pens']))
  })
})
