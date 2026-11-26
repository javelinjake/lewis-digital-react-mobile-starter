import type { GameConfig } from './config'
import { createRng, hashSeed } from '@ld/utils/random/rng'

// The arcade games are played on the phone, but every one of them is a pure function of its
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

// ---- Keepy-Uppy: tap the ball to keep it up. It drifts about and gets faster. ----

/** The game runs at 60 steps a second whatever the phone's frame rate. */
export const KEEPY_STEPS_PER_SECOND = 60
const DT = 1 / KEEPY_STEPS_PER_SECOND

/** A tap in Keepy-Uppy: the 60 Hz step it came on, and where, in pitch units (`x` from the left wall, `y` up from the ground). */
export interface KeepyTap {
  t: number
  x: number
  y: number
}

export interface KeepySim {
  seed: string
  /** Where the ball is, in pitch units: `x` its middle from the left wall, `y` its underside up from the ground (it starts at 60, in the middle). */
  x: number
  y: number
  vx: number
  vy: number
  step: number
  kicks: number
  /** Steps left in which a tap does nothing, after one that missed the ball or came too early. */
  stumble: number
  dropped: boolean
  /** The game is over: the ball dropped, the player reached the kick cap, or the clock ran out. */
  over: boolean
  /** The clock ran out with the ball still up. */
  timeUp: boolean
}

export function newKeepy(seed: string, config: Pick<GameConfig, 'minigames'>): KeepySim {
  return { seed, x: config.minigames.keepy.width / 2, y: 60, vx: 0, vy: 0, step: 0, kicks: 0, stumble: 0, dropped: false, over: false, timeUp: false }
}

const gravityAt = (kicks: number, config: Pick<GameConfig, 'minigames'>) => config.minigames.keepy.gravity * (1 + config.minigames.keepy.ramp * kicks)

/** The middle of the ball, in pitch units: `y` is the height of its underside. */
export function ballCentre(sim: Pick<KeepySim, 'x' | 'y'>, config: Pick<GameConfig, 'minigames'>) {
  return { x: sim.x, y: sim.y + config.minigames.keepy.ballRadius }
}

/** Whether a tap at (`x`, `y`) touches the ball. Squared distances, so every device and the server agree to the last bit. */
export function touchesBall(sim: Pick<KeepySim, 'x' | 'y'>, tap: { x: number, y: number }, config: Pick<GameConfig, 'minigames'>) {
  const centre = ballCentre(sim, config)
  const dx = tap.x - centre.x
  const dy = tap.y - centre.y
  const { hitRadius } = config.minigames.keepy
  return dx * dx + dy * dy <= hitRadius * hitRadius
}

/** Whether the ball is low enough, and falling, for the foot to reach it. */
export function inReach(sim: Pick<KeepySim, 'y' | 'vy'>, config: Pick<GameConfig, 'minigames'>) {
  return sim.vy < 0 && sim.y <= config.minigames.keepy.reach
}

/**
 * One 60th of a second. `tap` is where the player tapped during it, or null. A tap on the ball while it is low and
 * falling kicks it up to a height, and off to one side, drawn from the seed (the same for the server's replay). A tap
 * that misses the ball, or touches it too early, is a stumble. Pure: returns the next state.
 */
export function stepKeepy(sim: KeepySim, tap: { x: number, y: number } | null, config: Pick<GameConfig, 'minigames'>): KeepySim {
  if (sim.over)
    return sim
  const { stumbleSteps, minPeak, maxPeak, maxKicks, maxSeconds, width, ballRadius, drift } = config.minigames.keepy
  let { x, y, vx, vy, kicks, stumble } = sim

  if (stumble > 0) {
    stumble -= 1
  }
  else if (tap) {
    if (touchesBall(sim, tap, config) && inReach(sim, config)) {
      kicks += 1
      const rng = createRng(hashSeed(sim.seed, 'kick', kicks))
      const peak = minPeak + rng.next() * (maxPeak - minPeak)
      vy = Math.sqrt(2 * gravityAt(kicks, config) * Math.max(0, peak - y))
      vx = (rng.next() * 2 - 1) * drift
    }
    else {
      stumble = stumbleSteps
    }
  }

  vy -= gravityAt(kicks, config) * DT
  y += vy * DT
  x += vx * DT
  // Off the side walls.
  if (x < ballRadius) {
    x = 2 * ballRadius - x
    vx = -vx
  }
  else if (x > width - ballRadius) {
    x = 2 * (width - ballRadius) - x
    vx = -vx
  }
  const dropped = y <= 0
  const step = sim.step + 1
  const timeUp = !dropped && step >= maxSeconds * KEEPY_STEPS_PER_SECOND
  return { ...sim, x, y: Math.max(0, y), vx, vy, step, kicks, stumble, dropped, timeUp, over: dropped || timeUp || kicks >= maxKicks }
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

/** Replays a Keepy-Uppy play from its taps: the step of each and where it landed. */
export function runKeepy(seed: string, taps: readonly KeepyTap[], config: Pick<GameConfig, 'minigames'>): KeepyResult {
  const byStep = new Map(taps.map(tap => [tap.t, tap]))
  let sim = newKeepy(seed, config)
  // The clock ends every play, so this always finishes; the bound is only a guard against a bad config.
  const bound = (config.minigames.keepy.maxSeconds + 1) * KEEPY_STEPS_PER_SECOND
  while (!sim.over && sim.step < bound)
    sim = stepKeepy(sim, byStep.get(sim.step) ?? null, config)
  return { kicks: sim.kicks, score: keepyScore(sim.kicks, config), steps: sim.step, dropped: sim.dropped }
}

// ---- Rewards ----

/** Tokens (or coins) for a score: a share of the most a play can pay. */
export function shareOf(score: number, max: number, most: number) {
  return Math.floor((most * Math.max(0, Math.min(score, max))) / Math.max(1, max))
}
