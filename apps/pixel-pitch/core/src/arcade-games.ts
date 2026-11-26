import type { GameConfig } from './config'
import { createRng, hashSeed } from '@ld/utils/random/rng'

// Two more arcade games, each a different skill. Like the first three, each layout is a pure function of the play's
// seed and each score a pure function of the layout and what the player did, so the server can replay a play and
// pay what it is worth. Every number is in `config.minigames`.

type Config = Pick<GameConfig, 'minigames'>

const lerp = (from: number, to: number, t: number) => from + (to - from) * t
/** 0 for the first of `count`, 1 for the last. */
const along = (index: number, count: number) => (count > 1 ? index / (count - 1) : 0)

export interface GameScore {
  total: number
  max: number
  /** How long the play took at the least, in milliseconds: the server's clock must have run at least this long. */
  playMs: number
}

// ---- Keeper Reflex: you are in goal. A shot flies from the spot after a wait; tap the ball before it is in. ----

export interface KeeperShot {
  /** The wait before the shot is struck, so it cannot be anticipated. */
  delayMs: number
  /** How long the ball takes from the spot to the line. Shorter with every shot. */
  windowMs: number
  /** Where it crosses the line, in goal units (`x` from the left post, `y` up from the ground). */
  x: number
  y: number
  /** How far it bends sideways in flight, at the most (halfway): under 0 to the left. */
  curve: number
}

/** A tap at a shot: when (milliseconds after the shot's round began, the wait included) and where, in goal units. */
export interface KeeperTap {
  ms: number
  x: number
  y: number
}

export function keeperShots(seed: string, config: Config): KeeperShot[] {
  const { shots, minDelayMs, maxDelayMs, firstWindowMs, lastWindowMs, width, height, margin, maxCurve } = config.minigames.keeper
  const rng = createRng(hashSeed(seed, 'keeper'))
  return Array.from({ length: shots }, (_, index) => ({
    delayMs: rng.int(minDelayMs, maxDelayMs),
    windowMs: Math.round(lerp(firstWindowMs, lastWindowMs, along(index, shots))),
    x: Math.round(lerp(margin, width - margin, rng.next())),
    y: Math.round(lerp(margin, height - margin, rng.next())),
    curve: Math.round(lerp(-maxCurve, maxCurve, rng.next())),
  }))
}

/**
 * Where the ball is `ms` into the shot's round, in goal units, and how big (`radius`): on the spot until it is struck,
 * then flying at the goal, quick at first and slower as it goes away (it shrinks as it goes), bending on the way.
 * `progress` is 0 on the spot and 1 at the line. Only + - * /, so every phone and the server agree to the last bit.
 */
export function keeperBallAt(shot: KeeperShot, ms: number, config: Config) {
  const { width, spotDepth, spotRadius, lineRadius } = config.minigames.keeper
  const progress = Math.min(1, Math.max(0, (ms - shot.delayMs) / shot.windowMs))
  const eased = 1 - (1 - progress) * (1 - progress)
  const spotX = width / 2
  return {
    x: spotX + (shot.x - spotX) * eased + shot.curve * 4 * progress * (1 - progress),
    y: -spotDepth + (shot.y + spotDepth) * eased,
    radius: spotRadius + (lineRadius - spotRadius) * eased,
    progress,
  }
}

export type KeeperOutcome = 'saved' | 'early' | 'missed' | 'late'

/**
 * What a tap (or none: `null`) comes to. On the ball while it is in the air is a save. A tap before the shot, or
 * quicker than a person can react, is a guess: diving early. Off the ball is a goal, and so is no tap in time.
 */
export function keeperOutcome(shot: KeeperShot, tap: KeeperTap | null, config: Config): KeeperOutcome {
  if (!tap || tap.ms > shot.delayMs + shot.windowMs)
    return 'late'
  if (tap.ms < shot.delayMs + config.minigames.keeper.minReactionMs)
    return 'early'
  return touchesShot(shot, tap, config) ? 'saved' : 'missed'
}

/** Whether a tap lands on the ball, where it is at the tap. Squared distances, so every device and the server agree. */
export function touchesShot(shot: KeeperShot, tap: KeeperTap, config: Config) {
  const ball = keeperBallAt(shot, tap.ms, config)
  const dx = tap.x - ball.x
  const dy = tap.y - ball.y
  const { hitRadius } = config.minigames.keeper
  return dx * dx + dy * dy <= hitRadius * hitRadius
}

/** When a round is over: at the tap, or when the shot goes in. */
export function keeperRoundMs(shot: KeeperShot, tap: KeeperTap | null) {
  return tap ? Math.min(tap.ms, shot.delayMs + shot.windowMs) : shot.delayMs + shot.windowMs
}

export function scoreKeeper(seed: string, taps: ReadonlyArray<KeeperTap | null>, config: Config): GameScore {
  const shots = keeperShots(seed, config)
  if (taps.length !== shots.length)
    throw new Error(`A Keeper Reflex play has ${shots.length} shots.`)
  return {
    total: shots.filter((shot, index) => keeperOutcome(shot, taps[index], config) === 'saved').length,
    max: shots.length,
    playMs: shots.reduce((sum, shot, index) => sum + keeperRoundMs(shot, taps[index]), 0),
  }
}

// ---- Dribble Dash: run up the pitch, switching lane to go round the defenders. ----

export interface Defender {
  /** When the defender appears at the top. */
  atMs: number
  lane: number
  /** How long the defender takes to run the length of the pitch. Shorter as the run goes on. */
  fallMs: number
}

/** A lane change: when (milliseconds into the run) and into which lane. One lane at a time. */
export interface LaneMove {
  ms: number
  lane: number
}

export function dribbleRun(seed: string, config: Config): Defender[] {
  const { lanes, defenders: count, firstAtMs, firstGapMs, lastGapMs, gapJitterMs, firstFallMs, lastFallMs } = config.minigames.dribble
  const rng = createRng(hashSeed(seed, 'dribble'))
  const defenders: Defender[] = []
  let at = firstAtMs
  for (let index = 0; index < count; index++) {
    const progress = along(index, count)
    const recent = defenders.slice(-2).map(defender => defender.lane)
    // Never three in a row in one lane: the player always has to keep moving.
    const open = Array.from({ length: lanes }, (_, lane) => lane).filter(lane => !(recent.length === 2 && recent.every(entry => entry === lane)))
    defenders.push({ atMs: Math.round(at), lane: rng.pick(open), fallMs: Math.round(lerp(firstFallMs, lastFallMs, progress)) })
    at += lerp(firstGapMs, lastGapMs, progress) + rng.int(0, gapJitterMs)
  }
  return defenders
}

/** The lane the player starts in: the middle one. */
export function startLane(config: Config) {
  return Math.floor(config.minigames.dribble.lanes / 2)
}

/** How far down the pitch a defender is at `ms`: under 0 not yet on, over 1 gone. */
export function defenderProgress(defender: Defender, ms: number) {
  return (ms - defender.atMs) / defender.fallMs
}

/** When the run is over if nobody tackles the player: the last defender has gone. */
export function dribbleEndMs(defenders: readonly Defender[]) {
  const last = defenders.at(-1)
  return last ? last.atMs + last.fallMs : 0
}

/** The window in which a defender can tackle. */
function tackleWindow(defender: Defender, config: Config) {
  const { tackleFrom, tackleTo } = config.minigames.dribble
  return { from: defender.atMs + defender.fallMs * tackleFrom, to: defender.atMs + defender.fallMs * tackleTo }
}

/** The player's lane at `ms`, from the moves made. */
export function laneAt(moves: readonly LaneMove[], ms: number, config: Config) {
  let lane = startLane(config)
  for (const move of moves) {
    if (move.ms > ms)
      break
    lane = move.lane
  }
  return lane
}

/**
 * The first tackle, if any, up to `untilMs`: a player is tackled if they are in a defender's lane at any moment in its
 * tackle window. Worked out from the moves rather than frame by frame, so the phone and the server agree exactly.
 */
export function dribbleTackle(defenders: readonly Defender[], moves: readonly LaneMove[], config: Config, untilMs = Number.POSITIVE_INFINITY): { index: number, atMs: number } | null {
  let first: { index: number, atMs: number } | null = null
  for (const [index, defender] of defenders.entries()) {
    const { from, to } = tackleWindow(defender, config)
    if (from > untilMs || (first && from >= first.atMs))
      continue
    let atMs: number | null = laneAt(moves, from, config) === defender.lane ? from : null
    if (atMs === null) {
      const into = moves.find(move => move.ms > from && move.ms <= to && move.lane === defender.lane)
      atMs = into ? into.ms : null
    }
    if (atMs !== null && atMs <= untilMs && (!first || atMs < first.atMs))
      first = { index, atMs }
  }
  return first
}

/** Defenders the player has got past by `ms`. */
export function defendersBeaten(defenders: readonly Defender[], ms: number, config: Config) {
  return defenders.filter(defender => tackleWindow(defender, config).to < ms).length
}

/** Scores a Dribble Dash play from its lane changes: the defenders got past before a tackle, or all of them. */
export function scoreDribble(seed: string, moves: readonly LaneMove[], config: Config): GameScore & { tackled: boolean } {
  const defenders = dribbleRun(seed, config)
  const tackle = dribbleTackle(defenders, moves, config)
  const playMs = tackle ? tackle.atMs : dribbleEndMs(defenders)
  return { total: tackle ? defendersBeaten(defenders, tackle.atMs, config) : defenders.length, max: defenders.length, playMs, tackled: tackle !== null }
}
