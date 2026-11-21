import { createRng, hashSeed } from '@ld/utils/random/rng'

// The rules of the test games. Each layout is a pure function of a seed, like the arcade's, so a game that turns
// out to be fun can move to the arcade (where the server replays the taps) without being rewritten.

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

// ---- Keeper Reflex: a shot comes at one side of the goal; dive that way in time. ----

export type Side = 'left' | 'centre' | 'right'
export const SIDES: readonly Side[] = ['left', 'centre', 'right']

export interface KeeperShot {
  /** The wait before the shot is struck, so it cannot be anticipated. */
  delayMs: number
  side: Side
  /** How long the keeper has to dive. Shorter with every shot. */
  windowMs: number
}

export const KEEPER_SHOTS = 10

export function keeperShots(seed: string): KeeperShot[] {
  const rng = createRng(hashSeed(seed, 'keeper'))
  return Array.from({ length: KEEPER_SHOTS }, (_, index) => ({
    delayMs: rng.int(600, 1500),
    side: rng.pick(SIDES),
    windowMs: Math.round(lerp(900, 420, index / (KEEPER_SHOTS - 1))),
  }))
}

// ---- Pass Master: watch the passing move, then repeat it. One pass longer each round. ----

export const PASS_PLAYERS = 4
export const PASS_START = 3
export const PASS_ROUNDS = 8

/** The whole move: round `n` (from 0) uses the first `PASS_START + n` passes. No player passes to themself. */
export function passSequence(seed: string): number[] {
  const rng = createRng(hashSeed(seed, 'pass'))
  const sequence: number[] = []
  for (let index = 0; index < PASS_START + PASS_ROUNDS - 1; index++) {
    const others = Array.from({ length: PASS_PLAYERS }, (_, player) => player).filter(player => player !== sequence[index - 1])
    sequence.push(rng.pick(others))
  }
  return sequence
}

// ---- Dribble Dash: run up the pitch, switching lane to go round the defenders. ----

export const DRIBBLE_LANES = 3
/** Where a defender is, 0 (top) to 1 (past the player): it can tackle between these. */
export const TACKLE_FROM = 0.8
export const TACKLE_TO = 0.96

export interface Defender {
  /** When the defender appears at the top. */
  atMs: number
  lane: number
  /** How long the defender takes to run the length of the pitch. Shorter as the run goes on. */
  fallMs: number
}

export const DRIBBLE_MS = 25_000

export function dribbleRun(seed: string): Defender[] {
  const rng = createRng(hashSeed(seed, 'dribble'))
  const defenders: Defender[] = []
  let at = 900
  while (at < DRIBBLE_MS) {
    const progress = at / DRIBBLE_MS
    const recent = defenders.slice(-2).map(defender => defender.lane)
    // Never three in a row in one lane: the player always has to keep moving.
    const lanes = Array.from({ length: DRIBBLE_LANES }, (_, lane) => lane).filter(lane => !(recent.length === 2 && recent.every(entry => entry === lane)))
    defenders.push({ atMs: Math.round(at), lane: rng.pick(lanes), fallMs: Math.round(lerp(1700, 950, progress)) })
    at += lerp(950, 430, progress) + rng.int(0, 120)
  }
  return defenders
}

/** How far down the pitch a defender is at `ms`: under 0 not yet on, over 1 gone. */
export function defenderProgress(defender: Defender, ms: number) {
  return (ms - defender.atMs) / defender.fallMs
}

/** The defender that tackles a player in `lane` at `ms`, if any. */
export function tackledBy(defenders: readonly Defender[], lane: number, ms: number) {
  return defenders.find((defender) => {
    const progress = defenderProgress(defender, ms)
    return defender.lane === lane && progress >= TACKLE_FROM && progress <= TACKLE_TO
  })
}

/** Defenders the player has got past by `ms`. */
export function defendersBeaten(defenders: readonly Defender[], ms: number) {
  return defenders.filter(defender => defenderProgress(defender, ms) > TACKLE_TO).length
}

// ---- Target Practice: a target appears somewhere in the goal for a moment; hit it before it goes. ----

export interface Target {
  /** Where in the goal, as percentages of its width and height. */
  x: number
  y: number
  /** How long it stays. Shorter with every target. */
  lifeMs: number
}

export const TARGETS = 15

export function targetSpots(seed: string): Target[] {
  const rng = createRng(hashSeed(seed, 'targets'))
  let last = { x: 50, y: 50 }
  return Array.from({ length: TARGETS }, (_, index) => {
    // Far enough from the last one that the finger has to travel.
    let spot = last
    for (let tries = 0; tries < 20 && Math.hypot(spot.x - last.x, spot.y - last.y) < 30; tries++)
      spot = { x: rng.int(12, 88), y: rng.int(16, 84) }
    last = spot
    return { ...spot, lifeMs: Math.round(lerp(1150, 560, index / (TARGETS - 1))) }
  })
}

// ---- Cone Shuffle: the ball goes under a cone, the cones swap places, pick the right one. ----

export const CONES = 3
export const CONE_ROUNDS = 5

export interface ConeRound {
  /** The slot (0 to 2) the ball starts in. */
  ball: number
  /** Pairs of slots swapped, in order. */
  swaps: Array<[number, number]>
  /** How long each swap takes. Quicker every round. */
  swapMs: number
}

export function coneRound(seed: string, round: number): ConeRound {
  const rng = createRng(hashSeed(seed, 'cones', round))
  const t = round / (CONE_ROUNDS - 1)
  const swaps = Array.from({ length: 3 + round }, (): [number, number] => {
    const a = rng.int(0, CONES - 1)
    const b = (a + rng.int(1, CONES - 1)) % CONES
    return [a, b]
  })
  return { ball: rng.int(0, CONES - 1), swaps, swapMs: Math.round(lerp(520, 240, t)) }
}

/** Where the ball ends up: follow it through the swaps. */
export function ballSlot(round: Pick<ConeRound, 'ball' | 'swaps'>) {
  return round.swaps.reduce((slot, [a, b]) => (slot === a ? b : slot === b ? a : slot), round.ball)
}
