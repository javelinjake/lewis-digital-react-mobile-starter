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

// ---- Penalty Shootout: five penalties. The ball wanders about the goal and the keeper shuffles; tap to shoot. ----

/**
 * A closed loop through `x` (and `y`) points: it is at point `i` at `at[i]` milliseconds into the loop, and back at
 * the first at `loopMs`, then round again. Only + - * / on the way to a position, so every phone and the server get
 * the same number to the last bit (no sines: they can differ in the last place from one engine to another).
 */
export interface Loop {
  x: number[]
  y: number[]
  at: number[]
  loopMs: number
}

/** A penalty: the ball's loop about the goal (where the shot goes) and the keeper's along the line (`x` only). */
export interface PenaltyRound {
  ball: Loop
  keeper: Loop
}

export type PenaltyOutcome = 'wide' | 'over' | 'saved' | 'goal' | 'corner'

const lerp = (from: number, to: number, t: number) => from + (to - from) * t
const along = (index: number, count: number) => (count > 1 ? index / (count - 1) : 0)
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

function makeLoop(rng: ReturnType<typeof createRng>, count: number, minLegMs: number, maxLegMs: number, point: (index: number) => { x: number, y: number }): Loop {
  const loop: Loop = { x: [], y: [], at: [], loopMs: 0 }
  for (let index = 0; index < count; index++) {
    const { x, y } = point(index)
    loop.x.push(x)
    loop.y.push(y)
    loop.at.push(loop.loopMs)
    loop.loopMs += Math.round(minLegMs + rng.next() * (maxLegMs - minLegMs))
  }
  return loop
}

/** Which leg of the loop `ms` is on, and how far along it (0 to 1). */
function legOf(loop: Loop, ms: number) {
  const time = ((ms % loop.loopMs) + loop.loopMs) % loop.loopMs
  let leg = loop.at.length - 1
  while (leg > 0 && loop.at[leg] > time)
    leg--
  const length = legMs(loop, leg)
  return { leg, u: (time - loop.at[leg]) / length }
}

function legMs(loop: Loop, leg: number) {
  const count = loop.at.length
  const index = ((leg % count) + count) % count
  return (index + 1 < count ? loop.at[index + 1] : loop.loopMs) - loop.at[index]
}

/**
 * A smooth curve through the points (a cubic Hermite, its tangents set from the legs either side so the speed carries
 * on through each point): the ball sweeps about rather than stopping and starting.
 */
function smoothOn(values: readonly number[], loop: Loop, leg: number, u: number) {
  const count = values.length
  const before = (leg + count - 1) % count
  const next = (leg + 1) % count
  const after = (leg + 2) % count
  const here = legMs(loop, leg)
  const inTangent = ((values[next] - values[before]) / (legMs(loop, before) + here)) * here
  const outTangent = ((values[after] - values[leg]) / (here + legMs(loop, next))) * here
  const u2 = u * u
  const u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * values[leg] + (u3 - 2 * u2 + u) * inTangent + (-2 * u3 + 3 * u2) * values[next] + (u3 - u2) * outTangent
}

/** Eases from one point to the next, settling at each: the keeper sets themself, then moves off again. */
function easeOn(values: readonly number[], leg: number, u: number) {
  const next = (leg + 1) % values.length
  return values[leg] + (values[next] - values[leg]) * (u * u * (3 - 2 * u))
}

/**
 * Five penalties from the seed. In each, the ball loops through points spread over the goal and around it (every
 * fourth one in a corner of the goal, so the corners come round often), and the keeper moves between spots along the
 * line at speeds drawn from the seed. Each round is quicker than the one before.
 */
export function penaltyRounds(seed: string, config: Pick<GameConfig, 'minigames'>): PenaltyRound[] {
  const pens = config.minigames.pens
  const { goalWidth, goalHeight, wide, over, ballRadius, cornerWidth, cornerHeight } = pens
  const rng = createRng(hashSeed(seed, 'pens'))
  const anywhere = () => ({ x: -wide + rng.next() * (goalWidth + 2 * wide), y: ballRadius + rng.next() * (goalHeight + over - ballRadius) })
  const corner = () => {
    const right = rng.next() < 0.5
    const top = rng.next() < 0.6
    const x = 2 + rng.next() * (cornerWidth - 4)
    const y = top ? goalHeight - 2 - rng.next() * (cornerHeight - 4) : ballRadius + rng.next() * (cornerHeight - 2 - ballRadius)
    return { x: right ? goalWidth - x : x, y }
  }
  return Array.from({ length: pens.rounds }, (_, round) => {
    const pace = lerp(1, pens.lastPace, along(round, pens.rounds))
    let last = { x: goalWidth / 2, y: goalHeight / 2 }
    const ball = makeLoop(rng, pens.aimPoints, pens.aimLegMinMs * pace, pens.aimLegMaxMs * pace, (index) => {
      if (index % 4 === 1)
        return (last = corner())
      const far = (spot: { x: number, y: number }) => (spot.x - last.x) * (spot.x - last.x) + (spot.y - last.y) * (spot.y - last.y) >= pens.aimMinJump * pens.aimMinJump
      let spot = anywhere()
      for (let tries = 0; tries < 8 && !far(spot); tries++)
        spot = anywhere()
      return (last = spot)
    })
    const keeper = makeLoop(rng, pens.keeperPoints, pens.keeperLegMinMs * pace, pens.keeperLegMaxMs * pace, () => ({ x: lerp(pens.keeperMin, pens.keeperMax, rng.next()), y: 0 }))
    return { ball, keeper }
  })
}

/** Where the ball is `ms` into a round, in goal units: where a shot taken then goes. */
export function penaltyBallAt(round: PenaltyRound, ms: number, config: Pick<GameConfig, 'minigames'>) {
  const { goalWidth, goalHeight, wide, over, ballRadius } = config.minigames.pens
  const { leg, u } = legOf(round.ball, ms)
  return {
    x: clamp(smoothOn(round.ball.x, round.ball, leg, u), -wide, goalWidth + wide),
    y: clamp(smoothOn(round.ball.y, round.ball, leg, u), ballRadius, goalHeight + over),
  }
}

/** Where the keeper's middle is along the line `ms` into a round, in goal units. */
export function keeperAt(round: PenaltyRound, ms: number) {
  const { leg, u } = legOf(round.keeper, ms)
  return easeOn(round.keeper.x, leg, u)
}

/** Whether the keeper, standing at `keeper`, reaches a ball at (`x`, `y`). Squared, so every device agrees. */
export function keeperReaches(keeper: number, ball: { x: number, y: number }, config: Pick<GameConfig, 'minigames'>) {
  const { reachX, reachY, reachMid } = config.minigames.pens
  const dx = ball.x - keeper
  const dy = ball.y - reachMid
  return dx * dx * reachY * reachY + dy * dy * reachX * reachX <= reachX * reachX * reachY * reachY
}

export interface PenaltyShot {
  outcome: PenaltyOutcome
  points: number
  /** Where the shot went, in goal units. */
  x: number
  y: number
  /** Where the keeper stood. */
  keeper: number
}

/**
 * What a penalty taken `ms` into its round comes to: it goes where the ball is. Wide of a post or over the bar is
 * nothing; inside the keeper's reach is saved; in one of the four corners is 2; anywhere else in the goal is 1.
 */
export function penaltyShot(round: PenaltyRound, ms: number, config: Pick<GameConfig, 'minigames'>): PenaltyShot {
  const { goalWidth, goalHeight, cornerWidth, cornerHeight } = config.minigames.pens
  const { x, y } = penaltyBallAt(round, ms, config)
  const keeper = keeperAt(round, ms)
  const shot = (outcome: PenaltyOutcome, points: number): PenaltyShot => ({ outcome, points, x, y, keeper })
  if (x < 0 || x > goalWidth)
    return shot('wide', 0)
  if (y > goalHeight)
    return shot('over', 0)
  if (keeperReaches(keeper, { x, y }, config))
    return shot('saved', 0)
  const inCorner = (x <= cornerWidth || x >= goalWidth - cornerWidth) && (y >= goalHeight - cornerHeight || y <= cornerHeight)
  return inCorner ? shot('corner', 2) : shot('goal', 1)
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
