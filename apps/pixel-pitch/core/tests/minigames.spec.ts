import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, KEEPY_STEPS_PER_SECOND, keepyMax, keepyScore, kickRounds, markerAt, newKeepy, nextKickGolden, runKeepy, scoreKick, shareOf, stepKeepy, targetAt, warmupBar, warmupZone } from '../src'

const config = DEFAULT_CONFIG
const { reach } = config.minigames.keepy

/** The millisecond at which a bar's marker is closest to its target: what a perfect player taps on. */
function perfectTap(bar: { speed: number, phase: number, centre: number, drift?: number, driftPhase?: number }, from = 150, to = 4000) {
  const target = (ms: number) => targetAt({ drift: 0, driftPhase: 0, ...bar }, ms)
  let best = from
  for (let ms = from; ms <= to; ms++) {
    if (Math.abs(markerAt(bar, ms) - target(ms)) < Math.abs(markerAt(bar, best) - target(best)))
      best = ms
  }
  return best
}

/**
 * Plays Keepy-Uppy like a player who taps `delay` steps after the ball reaches the foot, recording the taps. A real
 * player wobbles: `jitter` makes each kick a little early or late, by up to about 2 steps at 2, the same every run.
 */
function playKeepy(seed: string, delay: number, jitter = 0) {
  let sim = newKeepy(seed)
  const taps: number[] = []
  let was = false
  let wait = -1
  let kick = 0
  while (!sim.over && sim.step < 7200) {
    const inReach = sim.vy < 0 && sim.y <= reach
    if (inReach && !was)
      wait = Math.max(0, delay + Math.round(((((kick++ * 7919 + seed.length * 31) % 7) - 3) / 3) * jitter))
    was = inReach
    let tap = false
    if (wait === 0) {
      tap = true
      wait = -1
    }
    else if (wait > 0) {
      wait--
    }
    if (tap)
      taps.push(sim.step)
    sim = stepKeepy(sim, tap, config)
  }
  return { taps, sim }
}

describe('the marker', () => {
  it('stays on the bar and bounces from end to end', () => {
    const bar = { speed: 1.2, phase: 0.3, centre: 0.5 }
    const positions = Array.from({ length: 4000 }, (_, ms) => markerAt(bar, ms))
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...positions)).toBeLessThanOrEqual(1)
    expect(Math.max(...positions)).toBeGreaterThan(0.98)
    expect(Math.min(...positions)).toBeLessThan(0.02)
    for (let ms = 1; ms < 4000; ms++)
      expect(Math.abs(positions[ms] - positions[ms - 1])).toBeLessThan(0.01)
  })
})

describe('Kick Timer', () => {
  const kick = config.minigames.kick

  it('lays out five rounds from the seed: the same for a seed, different for another, always inside the ranges', () => {
    const rounds = kickRounds('club:kick:1', config)
    expect(rounds).toHaveLength(5)
    expect(kickRounds('club:kick:1', config)).toEqual(rounds)
    expect(kickRounds('club:kick:2', config)).not.toEqual(rounds)
    for (const round of rounds) {
      const fast = round.kind === 'fast' ? kick.fastFactor : 1
      expect(round.speed).toBeGreaterThanOrEqual(kick.minSpeed * fast - 1e-9)
      expect(round.speed).toBeLessThanOrEqual(kick.maxSpeed * fast + 1e-9)
      expect(round.centre).toBeGreaterThanOrEqual(0.25)
      expect(round.centre).toBeLessThanOrEqual(0.75)
    }
  })

  it('gives every play its own mix of rounds: steady to start, fast to finish, and never the same twist twice in a row', () => {
    const kinds = new Set<string>()
    for (let club = 0; club < 200; club++) {
      const rounds = kickRounds(`club:kick:${club}`, config)
      expect(rounds[0].kind).toBe('steady')
      expect(rounds.at(-1)!.kind).toBe('fast')
      for (let round = 1; round < rounds.length; round++)
        expect(rounds[round].kind).not.toBe(rounds[round - 1].kind)
      rounds.forEach(round => kinds.add(round.kind))
    }
    expect(kinds).toEqual(new Set(['steady', 'fast', 'narrow', 'moving']))
  })

  it('has rounds that differ in what they ask: narrow zones are smaller and a moving target swings', () => {
    const rounds = Array.from({ length: 100 }, (_, club) => kickRounds(`club:kick:${club}`, config)).flat()
    const narrow = rounds.find(round => round.kind === 'narrow')!
    const moving = rounds.find(round => round.kind === 'moving')!
    const steady = rounds.find(round => round.kind === 'steady')!
    expect(narrow.zone).toBe(kick.narrowZone)
    expect(steady.zone).toBe(1)
    const targets = Array.from({ length: 4000 }, (_, ms) => targetAt(moving, ms))
    expect(Math.max(...targets) - Math.min(...targets)).toBeGreaterThan(kick.drift * 1.8)
    expect(Math.min(...targets)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...targets)).toBeLessThanOrEqual(1)
    expect(new Set(Array.from({ length: 4000 }, (_, ms) => targetAt(steady, ms))).size).toBe(1)
  })

  it('pays 3 points for a tap in the middle, doubles a kick that follows a perfect one, and nothing for one far away', () => {
    const rounds = kickRounds('club:kick:7', config)
    const perfect = rounds.map(round => perfectTap(round))
    // Perfect, then four doubled perfects: 3 + 6 + 6 + 6 + 6.
    expect(scoreKick('club:kick:7', perfect, config)).toMatchObject({ total: 27, max: 27, points: [3, 6, 6, 6, 6], doubled: [false, true, true, true, true] })

    // Tap where the marker is as far from the target as it gets.
    const worst = rounds.map((round) => {
      let ms = 150
      for (let t = 150; t < 4000; t++) {
        if (Math.abs(markerAt(round, t) - targetAt(round, t)) > Math.abs(markerAt(round, ms) - targetAt(round, ms)))
          ms = t
      }
      return ms
    })
    expect(scoreKick('club:kick:7', worst, config)).toMatchObject({ total: 0, doubled: [false, false, false, false, false] })
  })

  it('doubles only the kick right after a perfect one, and whatever it scores', () => {
    const rounds = kickRounds('club:kick:11', config)
    const perfect = rounds.map(round => perfectTap(round))
    // A perfect first kick, then a kick that is not perfect (a little late), then a perfect one: no double on the third.
    const late = perfect.map((ms, index) => (index === 1 ? ms + 90 : ms))
    const score = scoreKick('club:kick:11', late, config)
    expect(score.points[0]).toBe(3)
    expect(score.doubled[1]).toBe(true)
    expect(score.doubled[2]).toBe(false)
    expect(score.points[2]).toBe(3)
    expect(score.points[1]).toBeLessThanOrEqual(6)
  })

  it('shrinks the zones in a narrow round: a tap that is good in a steady round can miss in a narrow one', () => {
    const seed = Array.from({ length: 300 }, (_, club) => `club:kick:${club}`).find(candidate => kickRounds(candidate, config).some(round => round.kind === 'narrow'))!
    const rounds = kickRounds(seed, config)
    const index = rounds.findIndex(round => round.kind === 'narrow')
    const round = rounds[index]
    const best = perfectTap(round)
    // Move the tap until the marker is just outside the narrow "ok" zone but inside the ordinary one.
    let found = false
    for (let ms = best; ms < best + 600 && !found; ms++) {
      const distance = Math.abs(markerAt(round, ms) - targetAt(round, ms))
      if (distance > kick.ok * kick.narrowZone && distance <= kick.ok) {
        const taps = rounds.map((_, i) => (i === index ? ms : 150))
        expect(scoreKick(seed, taps, config).points[index]).toBe(0)
        found = true
      }
    }
    expect(found).toBe(true)
  })

  it('gives partial points close to the target', () => {
    const [round] = kickRounds('club:kick:9', config)
    const offsets = [0, 1, 2, 3].map(step => perfectTap(round) + step * 60)
    const points = offsets.map(tap => scoreKick('club:kick:9', [tap, 150, 150, 150, 150], config).points[0])
    expect(points[0]).toBe(3)
    expect(Math.min(...points)).toBeLessThan(3)
  })

  it('needs exactly one tap for each kick', () => {
    expect(() => scoreKick('club:kick:1', [500, 500], config)).toThrow()
  })
})

describe('the warm-up kick', () => {
  it('is gold in the middle, green near it and a miss far from it', () => {
    const seed = 'club:warmup:3'
    const bar = warmupBar(seed, config)
    expect(warmupBar(seed, config)).toEqual(bar)
    expect(warmupZone(seed, perfectTap(bar), config)).toBe('gold')
    const zones = new Set(Array.from({ length: 4000 }, (_, ms) => warmupZone(seed, ms, config)))
    expect(zones).toEqual(new Set(['gold', 'green', 'miss']))
  })

  it('has zones of the configured widths: a gold tap is within 5% of the bar, green within 15%', () => {
    const seed = 'club:warmup:4'
    const bar = warmupBar(seed, config)
    for (let ms = 0; ms < 4000; ms += 7) {
      const distance = Math.abs(markerAt(bar, ms) - bar.centre)
      const zone = warmupZone(seed, ms, config)
      expect(zone === 'gold').toBe(distance <= config.minigames.warmup.goldWidth / 2)
      expect(zone === 'green').toBe(distance > config.minigames.warmup.goldWidth / 2 && distance <= config.minigames.warmup.greenWidth / 2)
    }
  })
})

describe('Keepy-Uppy', () => {
  const keepy = config.minigames.keepy

  it('is played the same way every time: the same seed and taps always end in the same place', () => {
    const { taps, sim } = playKeepy('club:keepy:1', 4)
    const again = runKeepy('club:keepy:1', taps, config)
    expect(again).toEqual({ kicks: sim.kicks, score: keepyScore(sim.kicks, config), steps: sim.step, dropped: sim.dropped })
    expect(runKeepy('club:keepy:1', taps, config)).toEqual(again)
  })

  it('ends at once for a player who never taps: the ball drops with no kicks', () => {
    expect(runKeepy('club:keepy:2', [], config)).toMatchObject({ kicks: 0, score: 0, dropped: true })
  })

  it('can be played to the end by a player who times it very well, and the server replay agrees', () => {
    for (let club = 0; club < 10; club++) {
      const { taps, sim } = playKeepy(`club:keepy:${club}`, 2)
      expect(sim.kicks).toBe(keepy.maxKicks)
      expect(sim.dropped).toBe(false)
      expect(runKeepy(`club:keepy:${club}`, taps, config).kicks).toBe(keepy.maxKicks)
    }
  })

  it('is short: a perfect play ends in about 20 seconds and no play lasts past the clock', () => {
    for (let club = 0; club < 20; club++) {
      for (const delay of [0, 2, 6, 9, 14, 30]) {
        const { sim } = playKeepy(`club:keepy:${club}`, delay)
        expect(sim.step / KEEPY_STEPS_PER_SECOND).toBeLessThanOrEqual(keepy.maxSeconds)
      }
    }
    const perfect = Array.from({ length: 10 }, (_, club) => playKeepy(`club:keepy:${club}`, 1).sim.step / KEEPY_STEPS_PER_SECOND)
    expect(Math.max(...perfect)).toBeLessThan(26)
    expect(Math.min(...perfect)).toBeGreaterThan(15)
  })

  it('stops on the clock when the ball is still up, and says so', () => {
    // Slow the ball right down so a play outlasts the clock.
    const slow = { minigames: { ...config.minigames, keepy: { ...keepy, ramp: 0, gravity: 40, maxKicks: 1000, maxSeconds: 5 } } }
    let sim = newKeepy('club:keepy:9')
    let was = false
    let wait = -1
    while (!sim.over && sim.step < 7200) {
      const inReach = sim.vy < 0 && sim.y <= keepy.reach
      if (inReach && !was)
        wait = 1
      was = inReach
      const tap = wait === 0
      wait = tap ? -1 : wait > 0 ? wait - 1 : wait
      sim = stepKeepy(sim, tap, slow)
    }
    expect(sim.timeUp).toBe(true)
    expect(sim.dropped).toBe(false)
    expect(sim.step).toBe(5 * KEEPY_STEPS_PER_SECOND)
  })

  it('is steeply graded: a quick player gets about 30, a steady one about 20, a slow one fewer than 12', () => {
    const median = (delay: number) => Array.from({ length: 31 }, (_, club) => playKeepy(`club:keepy:${club}`, delay, 2).sim.kicks).sort((a, b) => a - b)[15]
    expect(median(3)).toBeGreaterThanOrEqual(27)
    expect(median(6)).toBeGreaterThanOrEqual(15)
    expect(median(6)).toBeLessThanOrEqual(28)
    expect(median(12)).toBeLessThan(12)
    expect(median(3)).toBeGreaterThan(median(6))
    expect(median(6)).toBeGreaterThan(median(9))
    expect(median(9)).toBeGreaterThan(median(12))
  })

  it('scores the kicks, with every tenth a golden ball that counts twice', () => {
    expect([0, 1, 9, 10, 11, 19, 20, 30].map(kicks => keepyScore(kicks, config))).toEqual([0, 1, 9, 11, 12, 20, 22, 33])
    expect(keepyMax(config)).toBe(33)
    expect(nextKickGolden(9, config)).toBe(true)
    expect(nextKickGolden(10, config)).toBe(false)
    expect(nextKickGolden(19, config)).toBe(true)
  })

  it('punishes mashing: tapping as fast as is allowed does far worse than good timing', () => {
    const mash = Array.from({ length: 600 }, (_, index) => index * 8)
    const results = Array.from({ length: 20 }, (_, club) => runKeepy(`club:keepy:${club}`, mash, config).kicks)
    const average = results.reduce((a, b) => a + b, 0) / results.length
    expect(average).toBeLessThan(keepy.maxKicks / 2)
  })

  it('ignores a tap while the player is stumbling after a mistimed one', () => {
    let sim = newKeepy('club:keepy:3')
    sim = stepKeepy(sim, true, config)
    expect(sim.kicks).toBe(0)
    expect(sim.stumble).toBe(keepy.stumbleSteps)
    const before = sim.stumble
    sim = stepKeepy(sim, true, config)
    expect(sim.stumble).toBe(before - 1)
  })
})

describe('shareOf', () => {
  it('pays a share of the most a play can pay, rounded down, within bounds', () => {
    expect(shareOf(15, 15, 60)).toBe(60)
    expect(shareOf(0, 15, 60)).toBe(0)
    expect(shareOf(7, 15, 60)).toBe(28)
    expect(shareOf(99, 15, 60)).toBe(60)
    expect(shareOf(-3, 15, 60)).toBe(0)
  })
})
