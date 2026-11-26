import { describe, expect, it } from 'vitest'
import type { KeepyTap } from '../src'
import { DEFAULT_CONFIG, inReach, KEEPY_STEPS_PER_SECOND, keepyMax, keepyScore, kickRounds, markerAt, newKeepy, nextKickGolden, runKeepy, scoreKick, shareOf, stepKeepy, targetAt } from '../src'

const config = DEFAULT_CONFIG

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
 * Plays Keepy-Uppy like a player who taps the ball `delay` steps after it comes within reach, recording the taps. A
 * real player wobbles: `jitter` makes each kick a little early or late, by up to about 2 steps at 2, the same every
 * run. `aim` is how far from the middle of the ball the finger lands, in pitch units.
 */
function playKeepy(seed: string, delay: number, jitter = 0, aim = 0) {
  let sim = newKeepy(seed, config)
  const taps: KeepyTap[] = []
  let was = false
  let wait = -1
  let kick = 0
  while (!sim.over && sim.step < 7200) {
    const reach = inReach(sim, config)
    if (reach && !was)
      wait = Math.max(0, delay + Math.round(((((kick++ * 7919 + seed.length * 31) % 7) - 3) / 3) * jitter))
    was = reach
    let tap: KeepyTap | null = null
    if (wait === 0) {
      tap = { t: sim.step, x: sim.x + aim, y: sim.y }
      wait = -1
    }
    else if (wait > 0) {
      wait--
    }
    if (tap)
      taps.push(tap)
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

describe('Keepy-Uppy', () => {
  const keepy = config.minigames.keepy

  it('is played the same way every time: the same seed and taps always end in the same place', () => {
    const { taps, sim } = playKeepy('club:keepy:1', 4)
    const again = runKeepy('club:keepy:1', taps, config)
    expect(again).toEqual({ kicks: sim.kicks, score: keepyScore(sim.kicks, config), steps: sim.step, dropped: sim.dropped })
    expect(runKeepy('club:keepy:1', taps, config)).toEqual(again)
    // A tap carries where it landed as well as when: it survives the trip to the server and back as JSON.
    expect(runKeepy('club:keepy:1', JSON.parse(JSON.stringify(taps)) as KeepyTap[], config)).toEqual(again)
  })

  it('ends at once for a player who never taps: the ball drops with no kicks', () => {
    expect(runKeepy('club:keepy:2', [], config)).toMatchObject({ kicks: 0, score: 0, dropped: true })
  })

  it('can be played to the end by a player who times it very well, and the server replay agrees', () => {
    for (let club = 0; club < 10; club++) {
      const { taps, sim } = playKeepy(`club:keepy:${club}`, 2)
      expect(sim.kicks).toBe(keepy.maxKicks)
      expect(sim.dropped).toBe(false)
      expect(runKeepy(`club:keepy:${club}`, taps, config)).toMatchObject({ kicks: keepy.maxKicks, score: keepyMax(config) })
    }
  })

  it('sends the ball off sideways after a kick, by a different amount each time, and keeps it between the side walls', () => {
    const xs = new Set<number>()
    const drifts = new Set<number>()
    for (let club = 0; club < 10; club++) {
      let sim = newKeepy(`club:keepy:${club}`, config)
      expect(sim.x).toBe(keepy.width / 2)
      let was = false
      while (!sim.over) {
        const reach = inReach(sim, config)
        const tap = reach && !was ? { x: sim.x, y: sim.y } : null
        was = reach
        const before = sim.kicks
        sim = stepKeepy(sim, tap, config)
        if (sim.kicks > before)
          drifts.add(Math.round(sim.vx))
        expect(sim.x).toBeGreaterThanOrEqual(keepy.ballRadius - 1e-9)
        expect(sim.x).toBeLessThanOrEqual(keepy.width - keepy.ballRadius + 1e-9)
        expect(Math.abs(sim.vx)).toBeLessThanOrEqual(keepy.drift)
        xs.add(Math.round(sim.x))
      }
    }
    // Both ways, and right across the play area.
    expect([...drifts].some(vx => vx < 0) && [...drifts].some(vx => vx > 0)).toBe(true)
    expect(drifts.size).toBeGreaterThan(10)
    expect(Math.min(...xs)).toBeLessThan(keepy.width * 0.25)
    expect(Math.max(...xs)).toBeGreaterThan(keepy.width * 0.75)
  })

  it('kicks the ball to a different height each time', () => {
    const peaks: number[] = []
    let sim = newKeepy('club:keepy:4', config)
    let was = false
    let top = 0
    while (!sim.over) {
      const reach = inReach(sim, config)
      const tap = reach && !was ? { x: sim.x, y: sim.y } : null
      was = reach
      const before = sim.kicks
      sim = stepKeepy(sim, tap, config)
      if (sim.kicks > before && top > 0)
        peaks.push(top)
      top = sim.kicks > before ? 0 : Math.max(top, sim.y)
    }
    expect(Math.max(...peaks) - Math.min(...peaks)).toBeGreaterThan((keepy.maxPeak - keepy.minPeak) / 2)
  })

  it('counts a tap only on the ball: one that misses it is a stumble', () => {
    // Wait for the ball to come within reach, then tap well wide of it.
    let sim = newKeepy('club:keepy:5', config)
    while (!inReach(sim, config))
      sim = stepKeepy(sim, null, config)
    const wide = stepKeepy(sim, { x: sim.x + keepy.hitRadius + 1, y: sim.y }, config)
    expect(wide.kicks).toBe(0)
    expect(wide.stumble).toBe(keepy.stumbleSteps)
    // The same moment, a tap at the edge of the forgiving circle kicks it.
    const edge = stepKeepy(sim, { x: sim.x + keepy.hitRadius * 0.6, y: sim.y + keepy.hitRadius * 0.6 }, config)
    expect(edge.kicks).toBe(1)
    expect(edge.vy).toBeGreaterThan(0)
  })

  it('scores a tap off the ball as a miss in a replay too: aiming wide all game scores nothing', () => {
    const { taps } = playKeepy('club:keepy:6', 2, 0, keepy.hitRadius + 2)
    expect(runKeepy('club:keepy:6', taps, config)).toMatchObject({ kicks: 0, score: 0, dropped: true })
    const close = playKeepy('club:keepy:6', 2, 0, keepy.hitRadius - 2)
    expect(runKeepy('club:keepy:6', close.taps, config).kicks).toBe(keepy.maxKicks)
  })

  it('is short: a perfect play ends in about 20 seconds and no play lasts past the clock', () => {
    for (let club = 0; club < 20; club++) {
      for (const delay of [0, 2, 6, 9, 14, 30]) {
        const { sim } = playKeepy(`club:keepy:${club}`, delay)
        expect(sim.step / KEEPY_STEPS_PER_SECOND).toBeLessThanOrEqual(keepy.maxSeconds)
      }
    }
    const perfect = Array.from({ length: 10 }, (_, club) => playKeepy(`club:keepy:${club}`, 1).sim.step / KEEPY_STEPS_PER_SECOND)
    expect(Math.max(...perfect)).toBeLessThan(28)
    expect(Math.min(...perfect)).toBeGreaterThan(15)
  })

  it('stops on the clock when the ball is still up, and says so', () => {
    // Slow the ball right down so a play outlasts the clock.
    const slow = { minigames: { ...config.minigames, keepy: { ...keepy, ramp: 0, gravity: 40, maxKicks: 1000, maxSeconds: 5 } } }
    let sim = newKeepy('club:keepy:9', slow)
    let was = false
    let wait = -1
    while (!sim.over && sim.step < 7200) {
      const reach = inReach(sim, slow)
      if (reach && !was)
        wait = 1
      was = reach
      const tap = wait === 0
      wait = tap ? -1 : wait > 0 ? wait - 1 : wait
      sim = stepKeepy(sim, tap ? { x: sim.x, y: sim.y } : null, slow)
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

  it('punishes mashing: tapping the middle of the play area as fast as is allowed does far worse than good timing', () => {
    const mash = Array.from({ length: 600 }, (_, index) => ({ t: index * 8, x: keepy.width / 2, y: keepy.reach / 2 }))
    const results = Array.from({ length: 20 }, (_, club) => runKeepy(`club:keepy:${club}`, mash, config).kicks)
    const average = results.reduce((a, b) => a + b, 0) / results.length
    expect(average).toBeLessThan(keepy.maxKicks / 2)
  })

  it('ignores a tap while the player is stumbling after a mistimed one', () => {
    let sim = newKeepy('club:keepy:3', config)
    // On the ball, but far too early: it is still high up.
    sim = stepKeepy(sim, { x: sim.x, y: sim.y }, config)
    expect(sim.kicks).toBe(0)
    expect(sim.stumble).toBe(keepy.stumbleSteps)
    const before = sim.stumble
    sim = stepKeepy(sim, { x: sim.x, y: sim.y }, config)
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
