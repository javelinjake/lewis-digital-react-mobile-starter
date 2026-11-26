import type { LaneMove } from './arcade-games'
import type { CabinetTaps } from './arcade-taps'
import type { Cabinet } from './club-state'
import type { GameConfig } from './config'
import type { KeepyTap } from './minigames'
import { dribbleEndMs, dribbleRun, dribbleTackle, keeperBallAt, keeperShots, startLane } from './arcade-games'
import { ballCentre, inReach, kickRounds, markerAt, newKeepy, penaltyRounds, penaltyShot, stepKeepy, targetAt } from './minigames'

// A perfect player for every cabinet: what a play that scores the most sends. For the tests (core, api and app) and
// the playtest tools. It gives nothing away: the seed and the rules are on the phone already.

type Config = Pick<GameConfig, 'minigames'>

function kick(seed: string, config: Config) {
  return kickRounds(seed, config).map((bar) => {
    let best = 150
    for (let ms = 150; ms < 4000; ms++) {
      if (Math.abs(markerAt(bar, ms) - targetAt(bar, ms)) < Math.abs(markerAt(bar, best) - targetAt(bar, best)))
        best = ms
    }
    return best
  })
}

function pens(seed: string, config: Config) {
  return penaltyRounds(seed, config).map((round) => {
    for (let ms = 150; ms < 30_000; ms++) {
      if (penaltyShot(round, ms, config).outcome === 'corner')
        return ms
    }
    throw new Error('No corner shot in 30 seconds: the keeper covers it.')
  })
}

/** Taps the middle of the ball a step after it comes within reach. */
function keepy(seed: string, config: Config): KeepyTap[] {
  let sim = newKeepy(seed, config)
  const taps: KeepyTap[] = []
  let was = false
  let wait = -1
  while (!sim.over) {
    const reach = inReach(sim, config)
    if (reach && !was)
      wait = 1
    was = reach
    let tap: KeepyTap | null = null
    if (wait === 0) {
      tap = { t: sim.step, ...ballCentre(sim, config) }
      wait = -1
    }
    else if (wait > 0) {
      wait--
    }
    if (tap)
      taps.push(tap)
    sim = stepKeepy(sim, tap, config)
  }
  return taps
}

/** Taps the middle of the ball halfway between the quickest reaction and the line. */
function keeper(seed: string, config: Config) {
  const { minReactionMs } = config.minigames.keeper
  return keeperShots(seed, config).map((shot) => {
    const ms = shot.delayMs + minReactionMs + Math.floor((shot.windowMs - minReactionMs) / 2)
    const { x, y } = keeperBallAt(shot, ms, config)
    return { ms, x, y }
  })
}

/** Stands in a lane none of the next two defenders is coming down, moving one lane at a time. */
function dribble(seed: string, config: Config): LaneMove[] {
  const defenders = dribbleRun(seed, config)
  const { tackleTo, lanes } = config.minigames.dribble
  const moves: LaneMove[] = []
  let lane = startLane(config)
  let lastMove = Number.NEGATIVE_INFINITY
  for (let ms = 0; ms < dribbleEndMs(defenders); ms += 10) {
    const coming = defenders.filter(defender => defender.atMs + defender.fallMs * tackleTo >= ms).slice(0, 2).map(defender => defender.lane)
    const free = Array.from({ length: lanes }, (_, candidate) => candidate).filter(candidate => !coming.includes(candidate))
    const want = free.sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane))[0] ?? lane
    if (want !== lane && ms - lastMove >= config.minigames.minTapGapMs) {
      lane += Math.sign(want - lane)
      lastMove = ms
      moves.push({ ms, lane })
    }
  }
  if (dribbleTackle(defenders, moves, config))
    throw new Error('The perfect dribbler was tackled.')
  return moves
}

const PLAYERS: { [C in Cabinet]: (seed: string, config: Config) => CabinetTaps[C] } = { kick, pens, keepy, keeper, dribble }

/** What a perfect play of `cabinet` with `seed` sends: it scores the most the cabinet pays for. */
export function perfectTaps<C extends Cabinet>(cabinet: C, seed: string, config: Config): CabinetTaps[C] {
  return PLAYERS[cabinet](seed, config)
}
