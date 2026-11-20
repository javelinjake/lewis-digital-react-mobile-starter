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

/** What is different about a Kick Timer round. The first is always steady and the last always fast. */
export type RoundKind = 'steady' | 'fast' | 'narrow' | 'moving'

export interface Bar {
  /** Full trips along the bar per second (there and back is two). */
  speed: number
  /** Where the marker starts in its cycle, 0 to 1. */
  phase: number
  /** The middle of the target, 0 to 1. For a moving target, the middle of its swing. */
  centre: number
  kind: RoundKind
  /** How wide the target zones are, compared with usual: a narrow round is under 1. */
  zone: number
  /** How far a moving target swings either side of `centre`, as a fraction of the bar. 0 for a still one. */
  drift: number
  driftPhase: number
}

export function markerAt(bar: Pick<Bar, 'speed' | 'phase'>, ms: number) {
  return triangle(bar.phase + (bar.speed * ms) / 2000)
}

/** The middle of the target `ms` into the round. Still unless the round is a moving one. */
export function targetAt(bar: Pick<Bar, 'centre' | 'drift' | 'driftPhase'>, ms: number) {
  return bar.drift === 0 ? bar.centre : bar.centre + bar.drift * (triangle(bar.driftPhase + ms / 1800) * 2 - 1)
}

function makeBar(rng: ReturnType<typeof createRng>, minSpeed: number, maxSpeed: number): Bar {
  return { speed: minSpeed + rng.next() * (maxSpeed - minSpeed), phase: rng.next(), centre: 0.25 + rng.next() * 0.5, kind: 'steady', zone: 1, drift: 0, driftPhase: 0 }
}

// ---- Kick Timer: five kicks, stop the marker in the target. ----

const TWISTS: readonly RoundKind[] = ['steady', 'fast', 'narrow', 'moving']

/**
 * Five rounds. The first is steady, to get going, the last is fast, and the ones between are drawn from the seed:
 * steady, fast (the marker is quicker), narrow (the target is smaller) or moving (the target swings). Two rounds in a
 * row are never the same (the one before the last is never fast either), so no two plays feel alike.
 */
export function kickRounds(seed: string, config: Pick<GameConfig, 'minigames'>): Bar[] {
  const { rounds, minSpeed, maxSpeed, fastFactor, narrowZone, drift } = config.minigames.kick
  const rng = createRng(hashSeed(seed, 'kick'))
  const bars: Bar[] = []
  for (let round = 0; round < rounds; round++) {
    const bar = makeBar(rng, minSpeed, maxSpeed)
    const previous = bars[round - 1]?.kind
    const kind: RoundKind = round === 0
      ? 'steady'
      : round === rounds - 1
        ? 'fast'
        : rng.pick(TWISTS.filter(twist => twist !== previous && !(round === rounds - 2 && twist === 'fast')))
    const twist = rng.next()
    bars.push({
      ...bar,
      kind,
      speed: kind === 'fast' ? bar.speed * fastFactor : bar.speed,
      zone: kind === 'narrow' ? narrowZone : 1,
      drift: kind === 'moving' ? drift : 0,
      driftPhase: twist,
    })
  }
  return bars
}

export interface KickScore {
  /** What each kick scored: 0 to 3 (3 in the very middle, 2 close, 1 near, 0 a miss), doubled after a perfect one. */
  points: number[]
  /** Whether each kick was doubled because the one before was perfect. */
  doubled: boolean[]
  total: number
  /** The most a play can score: a perfect first kick, then doubled perfects. */
  max: number
}

/** 0 to 3 for how far the marker was from the middle of the target. `zone` shrinks the zones in a narrow round. */
export function kickPoints(distance: number, config: Pick<GameConfig, 'minigames'>, zone = 1): number {
  const { perfect, good, ok } = config.minigames.kick
  return distance <= perfect * zone ? 3 : distance <= good * zone ? 2 : distance <= ok * zone ? 1 : 0
}

/** Scores a Kick Timer play from `taps`: the milliseconds each kick was taken after its round began. */
export function scoreKick(seed: string, taps: readonly number[], config: Pick<GameConfig, 'minigames'>): KickScore {
  const rounds = kickRounds(seed, config)
  if (taps.length !== rounds.length)
    throw new Error(`A Kick Timer play has ${rounds.length} kicks.`)
  const base = rounds.map((bar, round) => kickPoints(Math.abs(markerAt(bar, taps[round]) - targetAt(bar, taps[round])), config, bar.zone))
  const doubled = base.map((_, round) => round > 0 && base[round - 1] === 3)
  const points = base.map((value, round) => (doubled[round] ? value * 2 : value))
  return { points, doubled, total: points.reduce((sum, value) => sum + value, 0), max: 3 + (rounds.length - 1) * 6 }
}

// ---- Penalty Shootout: five penalties, tap to shoot while the aim sweeps the goal and the keeper shuffles. ----

export interface PenaltyRound {
  /** The aim sweeping across the width of the goal, 0 (left) to 1 (right). */
  aim: Pick<Bar, 'speed' | 'phase'>
  /** The keeper shuffling along the line. */
  keeper: Pick<Bar, 'speed' | 'phase'>
}

export type PenaltyOutcome = 'wide' | 'saved' | 'goal' | 'corner'

export function penaltyRounds(seed: string, config: Pick<GameConfig, 'minigames'>): PenaltyRound[] {
  const { rounds, aimMinSpeed, aimMaxSpeed, keeperMinSpeed, keeperMaxSpeed } = config.minigames.pens
  const rng = createRng(hashSeed(seed, 'pens'))
  return Array.from({ length: rounds }, () => ({
    aim: { speed: aimMinSpeed + rng.next() * (aimMaxSpeed - aimMinSpeed), phase: rng.next() },
    keeper: { speed: keeperMinSpeed + rng.next() * (keeperMaxSpeed - keeperMinSpeed), phase: rng.next() },
  }))
}

/** Where the keeper stands `ms` into a round: always within the middle of the goal, so a corner can be out of reach. */
export function keeperAt(round: PenaltyRound, ms: number) {
  return 0.2 + 0.6 * markerAt(round.keeper, ms)
}

/** What a penalty taken `ms` into its round comes to. Wide of the posts is nothing; the keeper's reach saves it; the corners are worth 2. */
export function penaltyShot(round: PenaltyRound, ms: number, config: Pick<GameConfig, 'minigames'>): { outcome: PenaltyOutcome, points: number, aim: number, keeper: number } {
  const { post, corner, reach } = config.minigames.pens
  const aim = markerAt(round.aim, ms)
  const keeper = keeperAt(round, ms)
  if (aim < post || aim > 1 - post)
    return { outcome: 'wide', points: 0, aim, keeper }
  if (Math.abs(aim - keeper) <= reach)
    return { outcome: 'saved', points: 0, aim, keeper }
  if (aim < corner || aim > 1 - corner)
    return { outcome: 'corner', points: 2, aim, keeper }
  return { outcome: 'goal', points: 1, aim, keeper }
}

export interface PenaltyScore {
  points: number[]
  outcomes: PenaltyOutcome[]
  total: number
  max: number
}

/** Scores a Penalty Shootout play from `taps`: the milliseconds each penalty was taken after its round began. */
export function scorePenalties(seed: string, taps: readonly number[], config: Pick<GameConfig, 'minigames'>): PenaltyScore {
  const rounds = penaltyRounds(seed, config)
  if (taps.length !== rounds.length)
    throw new Error(`A Penalty Shootout play has ${rounds.length} penalties.`)
  const shots = rounds.map((round, index) => penaltyShot(round, taps[index], config))
  return { points: shots.map(shot => shot.points), outcomes: shots.map(shot => shot.outcome), total: shots.reduce((sum, shot) => sum + shot.points, 0), max: rounds.length * 2 }
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
  /** The game is over: the ball dropped, the player reached the kick cap, or the clock ran out. */
  over: boolean
  /** The clock ran out with the ball still up. */
  timeUp: boolean
}

export function newKeepy(seed: string): KeepySim {
  return { seed, y: 60, vy: 0, step: 0, kicks: 0, stumble: 0, dropped: false, over: false, timeUp: false }
}

const gravityAt = (kicks: number, config: Pick<GameConfig, 'minigames'>) => config.minigames.keepy.gravity * (1 + config.minigames.keepy.ramp * kicks)

/** One 60th of a second. `tap` is whether the player tapped during it. Pure: returns the next state. */
export function stepKeepy(sim: KeepySim, tap: boolean, config: Pick<GameConfig, 'minigames'>): KeepySim {
  if (sim.over)
    return sim
  const { reach, stumbleSteps, minPeak, maxPeak, maxKicks, maxSeconds } = config.minigames.keepy
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
  const step = sim.step + 1
  const timeUp = !dropped && step >= maxSeconds * KEEPY_STEPS_PER_SECOND
  return { ...sim, y: Math.max(0, y), vy, step, kicks, stumble, dropped, timeUp, over: dropped || timeUp || kicks >= maxKicks }
}

export interface KeepyResult {
  kicks: number
  /** The score: the kicks, with every golden ball counting twice. */
  score: number
  steps: number
  dropped: boolean
}

/** Every `goldenEvery`-th kick is golden and scores 2. */
export function keepyScore(kicks: number, config: Pick<GameConfig, 'minigames'>) {
  return kicks + Math.floor(kicks / config.minigames.keepy.goldenEvery)
}

/** The score of a perfect play. */
export function keepyMax(config: Pick<GameConfig, 'minigames'>) {
  return keepyScore(config.minigames.keepy.maxKicks, config)
}

/** Whether the next kick is a golden ball, so the game can draw it gold. */
export function nextKickGolden(kicks: number, config: Pick<GameConfig, 'minigames'>) {
  return (kicks + 1) % config.minigames.keepy.goldenEvery === 0
}

/** Replays a Keepy-Uppy play from the steps (0, 1, 2…) at which the player tapped. */
export function runKeepy(seed: string, tapSteps: readonly number[], config: Pick<GameConfig, 'minigames'>): KeepyResult {
  const taps = new Set(tapSteps)
  let sim = newKeepy(seed)
  // The clock ends every play, so this always finishes; the bound is only a guard against a bad config.
  const bound = (config.minigames.keepy.maxSeconds + 1) * KEEPY_STEPS_PER_SECOND
  while (!sim.over && sim.step < bound)
    sim = stepKeepy(sim, taps.has(sim.step), config)
  return { kicks: sim.kicks, score: keepyScore(sim.kicks, config), steps: sim.step, dropped: sim.dropped }
}

// ---- Rewards ----

/** Tokens (or coins) for a score: a share of the most a play can pay. */
export function shareOf(score: number, max: number, most: number) {
  return Math.floor((most * Math.max(0, Math.min(score, max))) / Math.max(1, max))
}
