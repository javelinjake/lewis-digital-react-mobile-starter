import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, kickRounds, markerAt, newKeepy, runKeepy, scoreKick, shareOf, stepKeepy, warmupBar, warmupZone } from '../src'

const config = DEFAULT_CONFIG
const { reach } = config.minigames.keepy

/** The millisecond at which a bar's marker is closest to its target: what a perfect player taps on. */
function perfectTap(bar: { speed: number, phase: number, centre: number }, from = 150, to = 4000) {
  let best = from
  for (let ms = from; ms <= to; ms++) {
    if (Math.abs(markerAt(bar, ms) - bar.centre) < Math.abs(markerAt(bar, best) - bar.centre))
      best = ms
  }
  return best
}

/** Plays Keepy-Uppy like a player who taps `delay` steps after the ball reaches the foot, recording the taps. */
function playKeepy(seed: string, delay: number) {
  let sim = newKeepy(seed)
  const taps: number[] = []
  let was = false
  let wait = -1
  while (!sim.over && sim.step < 7200) {
    const inReach = sim.vy < 0 && sim.y <= reach
    if (inReach && !was)
      wait = delay
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
  it('lays out five rounds from the seed: the same for a seed, different for another, always inside the ranges', () => {
    const rounds = kickRounds('club:kick:1', config)
    expect(rounds).toHaveLength(5)
    expect(kickRounds('club:kick:1', config)).toEqual(rounds)
    expect(kickRounds('club:kick:2', config)).not.toEqual(rounds)
    for (const round of rounds) {
      expect(round.speed).toBeGreaterThanOrEqual(config.minigames.kick.minSpeed)
      expect(round.speed).toBeLessThanOrEqual(config.minigames.kick.maxSpeed)
      expect(round.centre).toBeGreaterThanOrEqual(0.25)
      expect(round.centre).toBeLessThanOrEqual(0.75)
    }
  })

  it('pays 3 points for a tap in the middle, and nothing for one far away', () => {
    const rounds = kickRounds('club:kick:7', config)
    const perfect = rounds.map(round => perfectTap(round))
    expect(scoreKick('club:kick:7', perfect, config)).toMatchObject({ total: 15, max: 15, points: [3, 3, 3, 3, 3] })

    // Tap where the marker is as far from the target as it gets.
    const worst = rounds.map((round) => {
      let ms = 150
      for (let t = 150; t < 4000; t++) {
        if (Math.abs(markerAt(round, t) - round.centre) > Math.abs(markerAt(round, ms) - round.centre))
          ms = t
      }
      return ms
    })
    expect(scoreKick('club:kick:7', worst, config).total).toBe(0)
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
  it('is played the same way every time: the same seed and taps always end in the same place', () => {
    const { taps, sim } = playKeepy('club:keepy:1', 4)
    const again = runKeepy('club:keepy:1', taps, config)
    expect(again).toEqual({ kicks: sim.kicks, steps: sim.step, dropped: sim.dropped })
    expect(runKeepy('club:keepy:1', taps, config)).toEqual(again)
  })

  it('ends at once for a player who never taps: the ball drops with no kicks', () => {
    expect(runKeepy('club:keepy:2', [], config)).toMatchObject({ kicks: 0, dropped: true })
  })

  it('can be played to the end by a player who times it well, and the server replay agrees', () => {
    for (let club = 0; club < 10; club++) {
      const { taps, sim } = playKeepy(`club:keepy:${club}`, 6)
      expect(sim.kicks).toBe(config.minigames.keepy.maxKicks)
      expect(sim.dropped).toBe(false)
      expect(runKeepy(`club:keepy:${club}`, taps, config).kicks).toBe(config.minigames.keepy.maxKicks)
    }
  })

  it('gets harder: a player who is slow to react does worse than one who is quick', () => {
    const average = (delay: number) => Array.from({ length: 20 }, (_, club) => playKeepy(`club:keepy:${club}`, delay).sim.kicks).reduce((a, b) => a + b, 0) / 20
    expect(average(6)).toBeGreaterThan(average(14))
    expect(average(14)).toBeGreaterThan(average(30))
  })

  it('punishes mashing: tapping as fast as is allowed does far worse than good timing', () => {
    const mash = Array.from({ length: 600 }, (_, index) => index * 8)
    const results = Array.from({ length: 20 }, (_, club) => runKeepy(`club:keepy:${club}`, mash, config).kicks)
    const average = results.reduce((a, b) => a + b, 0) / results.length
    expect(average).toBeLessThan(config.minigames.keepy.maxKicks / 2)
  })

  it('ignores a tap while the player is stumbling after a mistimed one', () => {
    let sim = newKeepy('club:keepy:3')
    sim = stepKeepy(sim, true, config)
    expect(sim.kicks).toBe(0)
    expect(sim.stumble).toBe(config.minigames.keepy.stumbleSteps)
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
