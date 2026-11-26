import type { Cabinet, LaneMove } from '../src'
import { describe, expect, it } from 'vitest'
import { cabinetMax, CABINETS, defenderProgress, defendersBeaten, DEFAULT_CONFIG, DIVE_SIDES, dribbleEndMs, dribbleRun, dribbleTackle, isGameRuleError, keeperOutcome, keeperShots, laneAt, parseConfig, perfectTaps, scoreDribble, scoreKeeper, scorePlay, startLane } from '../src'

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
    expect(Object.fromEntries(CABINETS.map(cabinet => [cabinet, cabinetMax(cabinet, config)]))).toEqual({ kick: 27, keepy: 33, pens: 10, keeper: 10, dribble: 32 })
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

describe('the arcade', () => {
  it('has five games: Cone Shuffle, Target Practice and Pass Master are gone', () => {
    expect([...CABINETS]).toEqual(['kick', 'keepy', 'pens', 'keeper', 'dribble'])
    for (const gone of ['pass', 'targets', 'cones'])
      expect(code(() => scorePlay(gone as Cabinet, 's', [], config))).not.toBe('accepted')
  })

  it('still reads a saved config with the old games and the old warm-up bar in it', () => {
    const saved = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Record<string, any>
    saved.minigames.pass = { players: 4, start: 3, rounds: 8, showMs: 480, gapMs: 160 }
    saved.minigames.targets = { count: 15, width: 100, height: 80, margin: 12, minJump: 30, radius: 8, hitRadius: 11, firstLifeMs: 1150, lastLifeMs: 560 }
    saved.minigames.cones = { cones: 3, rounds: 5, firstSwaps: 3, swapsPerRound: 1, firstSwapMs: 520, lastSwapMs: 240, revealMs: 1100 }
    saved.minigames.warmup = { minSpeed: 1.1, maxSpeed: 1.9, goldWidth: 0.1, greenWidth: 0.3 }
    const parsed = parseConfig(saved)
    expect(Object.keys(parsed.minigames)).not.toContain('cones')
    expect(parsed.minigames.warmup).toEqual({ gold: 0.8, green: 0.45 })
  })
})
