import type { GameConfig } from './config'
import { createRng, hashSeed } from '@ld/utils/random/rng'

// Five more arcade games, each a different skill. Like the first three, each layout is a pure function of the play's
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

// ---- Keeper Reflex: a shot comes at one side of the goal after a wait; dive that way in time. ----

export type DiveSide = 'left' | 'centre' | 'right'
export const DIVE_SIDES: readonly DiveSide[] = ['left', 'centre', 'right']

export interface KeeperShot {
  /** The wait before the shot is struck, so it cannot be anticipated. */
  delayMs: number
  side: DiveSide
  /** How long the keeper has to dive once it is struck. Shorter with every shot. */
  windowMs: number
}

/** A dive: which way, and when, in milliseconds after the shot's round began (the wait included). */
export interface KeeperDive {
  side: DiveSide
  ms: number
}

export function keeperShots(seed: string, config: Config): KeeperShot[] {
  const { shots, minDelayMs, maxDelayMs, firstWindowMs, lastWindowMs } = config.minigames.keeper
  const rng = createRng(hashSeed(seed, 'keeper'))
  return Array.from({ length: shots }, (_, index) => ({
    delayMs: rng.int(minDelayMs, maxDelayMs),
    side: rng.pick(DIVE_SIDES),
    windowMs: Math.round(lerp(firstWindowMs, lastWindowMs, along(index, shots))),
  }))
}

export type KeeperOutcome = 'saved' | 'early' | 'wrong' | 'late'

/** What a dive (or none: `null`) comes to. A dive before the shot, or quicker than a person can react, is a guess. */
export function keeperOutcome(shot: KeeperShot, dive: KeeperDive | null, config: Config): KeeperOutcome {
  if (!dive || dive.ms > shot.delayMs + shot.windowMs)
    return 'late'
  if (dive.ms < shot.delayMs + config.minigames.keeper.minReactionMs)
    return 'early'
  return dive.side === shot.side ? 'saved' : 'wrong'
}

/** When a round is over: at the dive, or when the shot goes in. */
export function keeperRoundMs(shot: KeeperShot, dive: KeeperDive | null) {
  return dive ? Math.min(dive.ms, shot.delayMs + shot.windowMs) : shot.delayMs + shot.windowMs
}

export function scoreKeeper(seed: string, dives: ReadonlyArray<KeeperDive | null>, config: Config): GameScore {
  const shots = keeperShots(seed, config)
  if (dives.length !== shots.length)
    throw new Error(`A Keeper Reflex play has ${shots.length} shots.`)
  return {
    total: shots.filter((shot, index) => keeperOutcome(shot, dives[index], config) === 'saved').length,
    max: shots.length,
    playMs: shots.reduce((sum, shot, index) => sum + keeperRoundMs(shot, dives[index]), 0),
  }
}

// ---- Pass Master: watch the passing move, then repeat it. One pass longer each round. ----

/** The whole move: round `n` (from 0) uses the first `start + n` passes. No player passes to themself. */
export function passSequence(seed: string, config: Config): number[] {
  const { players, start, rounds } = config.minigames.pass
  const rng = createRng(hashSeed(seed, 'pass'))
  const sequence: number[] = []
  for (let index = 0; index < start + rounds - 1; index++) {
    const others = Array.from({ length: players }, (_, player) => player).filter(player => player !== sequence[index - 1])
    sequence.push(rng.pick(others))
  }
  return sequence
}

/** How many passes round `round` (from 0) asks for. */
export function passLength(round: number, config: Config) {
  return config.minigames.pass.start + round
}

/**
 * Scores a Pass Master play from the players tapped in each round. A round counts if it repeats the move exactly; the
 * first that does not ends the play, so no round may follow it.
 */
export function scorePass(seed: string, rounds: ReadonlyArray<readonly number[]>, config: Config): GameScore {
  const { showMs, gapMs } = config.minigames.pass
  const sequence = passSequence(seed, config)
  const max = config.minigames.pass.rounds
  if (rounds.length > max)
    throw new Error(`A Pass Master play has at most ${max} rounds.`)
  let total = 0
  let playMs = 0
  for (const [round, picks] of rounds.entries()) {
    const length = passLength(round, config)
    playMs += length * (showMs + gapMs) + picks.length * config.minigames.minTapGapMs
    const right = picks.length === length && picks.every((player, index) => player === sequence[index])
    if (!right) {
      if (round !== rounds.length - 1)
        throw new Error('A round follows a wrong one.')
      break
    }
    total += 1
  }
  return { total, max, playMs }
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

// ---- Target Practice: a target appears somewhere in the goal for a moment; hit it before it goes. ----

export interface Target {
  /** Where in the goal, in the goal's own units (`config.minigames.targets.width` by `height`). */
  x: number
  y: number
  /** How long it stays. Shorter with every target. */
  lifeMs: number
}

/** A tap at a target: when (milliseconds after it appeared) and where, in the goal's units. */
export interface TargetTap {
  ms: number
  x: number
  y: number
}

export function targetSpots(seed: string, config: Config): Target[] {
  const { count, width, height, margin, minJump, firstLifeMs, lastLifeMs } = config.minigames.targets
  const rng = createRng(hashSeed(seed, 'targets'))
  let last = { x: width / 2, y: height / 2 }
  return Array.from({ length: count }, (_, index) => {
    // Far enough from the last one that the finger has to travel.
    let spot = last
    for (let tries = 0; tries < 20 && distanceSquared(spot, last) < minJump * minJump; tries++)
      spot = { x: rng.int(Math.ceil(margin), Math.floor(width - margin)), y: rng.int(Math.ceil(margin), Math.floor(height - margin)) }
    last = spot
    return { ...spot, lifeMs: Math.round(lerp(firstLifeMs, lastLifeMs, along(index, count))) }
  })
}

function distanceSquared(a: { x: number, y: number }, b: { x: number, y: number }) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

/** Whether a tap hits a target: on it (within the forgiving radius) while it is still there. */
export function hitsTarget(target: Target, tap: TargetTap | null, config: Config) {
  const { hitRadius } = config.minigames.targets
  return tap !== null && tap.ms <= target.lifeMs && distanceSquared(target, tap) <= hitRadius * hitRadius
}

export function scoreTargets(seed: string, taps: ReadonlyArray<TargetTap | null>, config: Config): GameScore {
  const targets = targetSpots(seed, config)
  if (taps.length !== targets.length)
    throw new Error(`A Target Practice play has ${targets.length} targets.`)
  return {
    total: targets.filter((target, index) => hitsTarget(target, taps[index], config)).length,
    max: targets.length,
    playMs: targets.reduce((sum, target, index) => sum + Math.min(target.lifeMs, taps[index]?.ms ?? target.lifeMs), 0),
  }
}

// ---- Cone Shuffle: the ball goes under a cone, the cones swap places, pick the right one. ----

export interface ConeRound {
  /** The slot the ball starts in. */
  ball: number
  /** Pairs of slots swapped, in order. */
  swaps: Array<[number, number]>
  /** How long each swap takes. Quicker every round. */
  swapMs: number
}

export function coneRound(seed: string, round: number, config: Config): ConeRound {
  const { cones, rounds, firstSwaps, swapsPerRound, firstSwapMs, lastSwapMs } = config.minigames.cones
  const rng = createRng(hashSeed(seed, 'cones', round))
  const swaps = Array.from({ length: firstSwaps + round * swapsPerRound }, (): [number, number] => {
    const a = rng.int(0, cones - 1)
    const b = (a + rng.int(1, cones - 1)) % cones
    return [a, b]
  })
  return { ball: rng.int(0, cones - 1), swaps, swapMs: Math.round(lerp(firstSwapMs, lastSwapMs, along(round, rounds))) }
}

/** Where the ball ends up: follow it through the swaps. */
export function ballSlot(round: Pick<ConeRound, 'ball' | 'swaps'>) {
  return round.swaps.reduce((slot, [a, b]) => (slot === a ? b : slot === b ? a : slot), round.ball)
}

/** Scores a Cone Shuffle play from the slot picked in each round. */
export function scoreCones(seed: string, picks: readonly number[], config: Config): GameScore {
  const { rounds, revealMs } = config.minigames.cones
  if (picks.length !== rounds)
    throw new Error(`A Cone Shuffle play has ${rounds} rounds.`)
  const all = Array.from({ length: rounds }, (_, round) => coneRound(seed, round, config))
  return {
    total: all.filter((round, index) => ballSlot(round) === picks[index]).length,
    max: rounds,
    playMs: all.reduce((sum, round) => sum + revealMs + round.swaps.length * round.swapMs, 0),
  }
}
