import { describe, expect, it } from 'vitest'
import { LAB_GAMES, labGame } from '@/features/lab/lib/games'
import { ballSlot, CONE_ROUNDS, coneRound, CONES, defenderProgress, defendersBeaten, DRIBBLE_LANES, DRIBBLE_MS, dribbleRun, KEEPER_SHOTS, keeperShots, PASS_PLAYERS, PASS_ROUNDS, PASS_START, passSequence, SIDES, TACKLE_FROM, TACKLE_TO, tackledBy, TARGETS, targetSpots } from '@/features/lab/lib/rules'

const seeds = Array.from({ length: 60 }, (_, index) => `seed-${index}`)

describe('the test games', () => {
  it('are five, each testing a different skill', () => {
    expect(LAB_GAMES).toHaveLength(5)
    expect(new Set(LAB_GAMES.map(game => game.id)).size).toBe(5)
    expect(new Set(LAB_GAMES.map(game => game.skill)).size).toBe(5)
    expect(labGame('cones')?.name).toBe('Cone Shuffle')
    expect(labGame('pinball')).toBeUndefined()
  })
})

describe('keeper Reflex', () => {
  it('has ten shots, the same for a seed, with less time to dive on each', () => {
    const shots = keeperShots('a')
    expect(shots).toHaveLength(KEEPER_SHOTS)
    expect(keeperShots('a')).toEqual(shots)
    expect(keeperShots('b')).not.toEqual(shots)
    for (let index = 1; index < shots.length; index++)
      expect(shots[index].windowMs).toBeLessThan(shots[index - 1].windowMs)
    expect(shots[0].windowMs).toBe(900)
    expect(shots.at(-1)!.windowMs).toBe(420)
  })

  it('shoots at every side over many games, after a wait that cannot be anticipated', () => {
    const all = seeds.flatMap(seed => keeperShots(seed))
    expect(new Set(all.map(shot => shot.side))).toEqual(new Set(SIDES))
    expect(Math.min(...all.map(shot => shot.delayMs))).toBeGreaterThanOrEqual(600)
    expect(new Set(all.map(shot => shot.delayMs)).size).toBeGreaterThan(100)
  })
})

describe('pass Master', () => {
  it('is one move that grows a pass a round, among four players, never to the same player twice running', () => {
    for (const seed of seeds) {
      const sequence = passSequence(seed)
      expect(sequence).toHaveLength(PASS_START + PASS_ROUNDS - 1)
      expect(passSequence(seed)).toEqual(sequence)
      for (const [index, player] of sequence.entries()) {
        expect(player).toBeGreaterThanOrEqual(0)
        expect(player).toBeLessThan(PASS_PLAYERS)
        if (index > 0)
          expect(player).not.toBe(sequence[index - 1])
      }
    }
    expect(new Set(seeds.map(seed => passSequence(seed).join())).size).toBeGreaterThan(50)
  })
})

describe('dribble Dash', () => {
  it('sends defenders down three lanes for 25 seconds, closer together and faster as it goes', () => {
    const run = dribbleRun('a')
    expect(dribbleRun('a')).toEqual(run)
    expect(run.length).toBeGreaterThan(30)
    expect(run.at(-1)!.atMs).toBeLessThan(DRIBBLE_MS)
    expect(run.every(defender => defender.lane >= 0 && defender.lane < DRIBBLE_LANES)).toBe(true)
    expect(run[1].atMs - run[0].atMs).toBeGreaterThan(run.at(-1)!.atMs - run.at(-2)!.atMs)
    expect(run[0].fallMs).toBeGreaterThan(run.at(-1)!.fallMs)
  })

  it('never puts three in a row in one lane, and can always be survived', () => {
    for (const seed of seeds) {
      const run = dribbleRun(seed)
      for (let index = 2; index < run.length; index++)
        expect(run[index].lane === run[index - 1].lane && run[index].lane === run[index - 2].lane).toBe(false)
      // Only one defender can tackle at any moment, so there is always a free lane next to it. A player who stands
      // away from the next two defenders to arrive is never caught.
      for (let ms = 0; ms < DRIBBLE_MS + 2000; ms += 10) {
        const inRange = run.filter((defender) => {
          const progress = defenderProgress(defender, ms)
          return progress >= TACKLE_FROM && progress <= TACKLE_TO
        })
        expect(inRange.length, `${seed} at ${ms}`).toBeLessThanOrEqual(1)
        const coming = run.filter(defender => defenderProgress(defender, ms) <= TACKLE_TO).slice(0, 2).map(defender => defender.lane)
        const lane = [0, 1, 2].find(candidate => !coming.includes(candidate))!
        expect(tackledBy(run, lane, ms), `${seed} at ${ms}`).toBeUndefined()
      }
      expect(defendersBeaten(run, DRIBBLE_MS + 3000)).toBe(run.length)
    }
  })

  it('tackles a player who stands still in a defender\'s lane, and counts those already beaten', () => {
    const run = dribbleRun('b')
    const first = run[0]
    const meet = first.atMs + first.fallMs * 0.9
    expect(tackledBy(run, first.lane, meet)).toBe(first)
    expect(tackledBy(run, (first.lane + 1) % DRIBBLE_LANES, meet)).not.toBe(first)
    expect(defendersBeaten(run, 0)).toBe(0)
    expect(defendersBeaten(run, first.atMs + first.fallMs)).toBeGreaterThanOrEqual(1)
  })
})

describe('target Practice', () => {
  it('shows fifteen targets inside the goal, each for less time, each well away from the last', () => {
    for (const seed of seeds) {
      const spots = targetSpots(seed)
      expect(spots).toHaveLength(TARGETS)
      for (const [index, spot] of spots.entries()) {
        expect(spot.x).toBeGreaterThanOrEqual(12)
        expect(spot.x).toBeLessThanOrEqual(88)
        expect(spot.y).toBeGreaterThanOrEqual(16)
        expect(spot.y).toBeLessThanOrEqual(84)
        if (index > 0) {
          expect(spot.lifeMs).toBeLessThan(spots[index - 1].lifeMs)
          expect(Math.hypot(spot.x - spots[index - 1].x, spot.y - spots[index - 1].y)).toBeGreaterThanOrEqual(30)
        }
      }
    }
    expect(targetSpots('a')).toEqual(targetSpots('a'))
  })
})

describe('cone Shuffle', () => {
  it('swaps more, and quicker, every round, always two different cones', () => {
    for (const seed of seeds) {
      for (let round = 0; round < CONE_ROUNDS; round++) {
        const cones = coneRound(seed, round)
        expect(cones.swaps).toHaveLength(3 + round)
        expect(cones.ball).toBeGreaterThanOrEqual(0)
        expect(cones.ball).toBeLessThan(CONES)
        for (const [a, b] of cones.swaps) {
          expect(a).not.toBe(b)
          expect(Math.max(a, b)).toBeLessThan(CONES)
        }
        if (round > 0)
          expect(cones.swapMs).toBeLessThan(coneRound(seed, round - 1).swapMs)
      }
    }
  })

  it('follows the ball through the swaps', () => {
    expect(ballSlot({ ball: 0, swaps: [] })).toBe(0)
    expect(ballSlot({ ball: 0, swaps: [[0, 2]] })).toBe(2)
    expect(ballSlot({ ball: 0, swaps: [[1, 2]] })).toBe(0)
    expect(ballSlot({ ball: 1, swaps: [[1, 0], [0, 2], [2, 1]] })).toBe(1)
    // The ball ends in every slot over many games: there is nothing to guess from.
    expect(new Set(seeds.map(seed => ballSlot(coneRound(seed, 4))))).toEqual(new Set([0, 1, 2]))
  })
})
