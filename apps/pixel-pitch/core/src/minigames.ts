import type { GameConfig } from './config'
import type { WarmupZone } from './match'
import { createRng, hashSeed } from '@ld/utils/random/rng'

// The arcade games and the warm-up kick are played on the phone, but every one of them is a pure function of its
// seed and the player's taps. The server hands out a seed (a ticket), the phone plays, and the server replays the
// taps to get the score. A phone cannot claim a score the taps do not make.

/** A bar's marker position, 0 to 1, bouncing from one end to the other `speed` times a second. */
function triangle(cycles: number) {
  const fraction = cycles - Math.floor(cycles)
  return fraction < 0.5 ? fraction * 2 : 2 - fraction * 2
}

export interface Bar {
  /** Full trips along the bar per second (there and back is two). */
  speed: number
  /** Where the marker starts in its cycle, 0 to 1. */
  phase: number
  /** The middle of the target, 0 to 1. */
  centre: number
}

export function markerAt(bar: Pick<Bar, 'speed' | 'phase'>, ms: number) {
  return triangle(bar.phase + (bar.speed * ms) / 2000)
}

function makeBar(rng: ReturnType<typeof createRng>, minSpeed: number, maxSpeed: number): Bar {
  return { speed: minSpeed + rng.next() * (maxSpeed - minSpeed), phase: rng.next(), centre: 0.25 + rng.next() * 0.5 }
}

// ---- Kick Timer: five kicks, stop the marker in the target. ----

export function kickRounds(seed: string, config: Pick<GameConfig, 'minigames'>): Bar[] {
  const { rounds, minSpeed, maxSpeed } = config.minigames.kick
  const rng = createRng(hashSeed(seed, 'kick'))
  return Array.from({ length: rounds }, () => makeBar(rng, minSpeed, maxSpeed))
}

export interface KickScore {
  /** 0 to 3 for each kick: 3 in the very middle, 2 close, 1 near, 0 a miss. */
  points: number[]
  total: number
  max: number
}

export function kickPoints(distance: number, config: Pick<GameConfig, 'minigames'>): number {
  const { perfect, good, ok } = config.minigames.kick
  return distance <= perfect ? 3 : distance <= good ? 2 : distance <= ok ? 1 : 0
}

/** Scores a Kick Timer play from `taps`: the milliseconds each kick was taken after its round began. */
export function scoreKick(seed: string, taps: readonly number[], config: Pick<GameConfig, 'minigames'>): KickScore {
  const rounds = kickRounds(seed, config)
  if (taps.length !== rounds.length)
    throw new Error(`A Kick Timer play has ${rounds.length} kicks.`)
  const points = rounds.map((bar, round) => kickPoints(Math.abs(markerAt(bar, taps[round]) - bar.centre), config))
  return { points, total: points.reduce((sum, value) => sum + value, 0), max: rounds.length * 3 }
}

// ---- Warm-up kick: one try at a timing bar before the match. ----

export function warmupBar(seed: string, config: Pick<GameConfig, 'minigames'>): Bar {
  const { minSpeed, maxSpeed } = config.minigames.warmup
  return makeBar(createRng(hashSeed(seed, 'warmup')), minSpeed, maxSpeed)
}

export function warmupZone(seed: string, tapMs: number, config: Pick<GameConfig, 'minigames'>): WarmupZone {
  const bar = warmupBar(seed, config)
  const distance = Math.abs(markerAt(bar, tapMs) - bar.centre)
  const { goldWidth, greenWidth } = config.minigames.warmup
  return distance <= goldWidth / 2 ? 'gold' : distance <= greenWidth / 2 ? 'green' : 'miss'
}

// ---- Keepy-Uppy: tap to keep the ball up, which gets faster. ----

/** The game runs at 60 steps a second whatever the phone's frame rate. */
export const KEEPY_STEPS_PER_SECOND = 60
const DT = 1 / KEEPY_STEPS_PER_SECOND
/** A play that has not ended after this long is stopped (the ticket's life). */
export const KEEPY_MAX_STEPS = KEEPY_STEPS_PER_SECOND * 120

export interface KeepySim {
  seed: string
  /** Height above the ground, in pitch units (the ball starts at 60). */
  y: number
  vy: number
  step: number
  kicks: number
  /** Steps left in which a tap does nothing, after one badly timed. */
  stumble: number
  dropped: boolean
  /** The game is over: the ball dropped or the player reached the cap. */
  over: boolean
}

export function newKeepy(seed: string): KeepySim {
  return { seed, y: 60, vy: 0, step: 0, kicks: 0, stumble: 0, dropped: false, over: false }
}

const gravityAt = (kicks: number, config: Pick<GameConfig, 'minigames'>) => config.minigames.keepy.gravity * (1 + config.minigames.keepy.ramp * kicks)

/** One 60th of a second. `tap` is whether the player tapped during it. Pure: returns the next state. */
export function stepKeepy(sim: KeepySim, tap: boolean, config: Pick<GameConfig, 'minigames'>): KeepySim {
  if (sim.over)
    return sim
  const { reach, stumbleSteps, minPeak, maxPeak, maxKicks } = config.minigames.keepy
  let { y, vy, kicks, stumble } = sim

  if (stumble > 0)
    stumble -= 1
  else if (tap) {
    if (vy < 0 && y <= reach) {
      // The foot meets the ball: kick it to a height drawn from the seed (the same for the server's replay).
      kicks += 1
      const peak = minPeak + createRng(hashSeed(sim.seed, 'kick', kicks)).next() * (maxPeak - minPeak)
      vy = Math.sqrt(2 * gravityAt(kicks, config) * Math.max(0, peak - y))
    }
    else {
      stumble = stumbleSteps
    }
  }

  vy -= gravityAt(kicks, config) * DT
  y += vy * DT
  const dropped = y <= 0
  return { ...sim, y: Math.max(0, y), vy, step: sim.step + 1, kicks, stumble, dropped, over: dropped || kicks >= maxKicks }
}

export interface KeepyResult {
  kicks: number
  steps: number
  dropped: boolean
}

/** Replays a Keepy-Uppy play from the steps (0, 1, 2…) at which the player tapped. */
export function runKeepy(seed: string, tapSteps: readonly number[], config: Pick<GameConfig, 'minigames'>): KeepyResult {
  const taps = new Set(tapSteps)
  let sim = newKeepy(seed)
  while (!sim.over && sim.step < KEEPY_MAX_STEPS)
    sim = stepKeepy(sim, taps.has(sim.step), config)
  return { kicks: sim.kicks, steps: sim.step, dropped: sim.dropped }
}

// ---- Rewards ----

/** Tokens (or coins) for a score: a share of the most a play can pay. */
export function shareOf(score: number, max: number, most: number) {
  return Math.floor((most * Math.max(0, Math.min(score, max))) / Math.max(1, max))
}
