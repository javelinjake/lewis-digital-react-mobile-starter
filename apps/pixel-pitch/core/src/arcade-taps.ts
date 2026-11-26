import type { KeeperDive, LaneMove, TargetTap } from './arcade-games'
import type { Cabinet } from './club-state'
import type { GameConfig } from './config'
import type { KeepyTap } from './minigames'
import { DIVE_SIDES, scoreCones, scoreDribble, scoreKeeper, scorePass, scoreTargets } from './arcade-games'
import { GameRuleError } from './errors'
import { KEEPY_STEPS_PER_SECOND, keepyMax, runKeepy, scoreKick, scorePenalties } from './minigames'

type Config = Pick<GameConfig, 'minigames'>

/**
 * What the phone sends when a play ends, for each cabinet: enough for the server to replay the play and score it.
 *
 * - kick, pens: the milliseconds into each round at which the player tapped.
 * - keepy: each tap's 60 Hz step and where it landed, in pitch units.
 * - keeper: each shot's dive (which way, and when), or null for none.
 * - pass: the players tapped in each round, in order.
 * - dribble: each lane change, with when.
 * - targets: each target's tap (when after it appeared, and where), or null for none.
 * - cones: the slot picked in each round.
 */
export interface CabinetTaps {
  kick: number[]
  pens: number[]
  keepy: KeepyTap[]
  keeper: Array<KeeperDive | null>
  pass: number[][]
  dribble: LaneMove[]
  targets: Array<TargetTap | null>
  cones: number[]
}

export type AnyTaps = CabinetTaps[Cabinet]

export interface PlayScore {
  score: number
  max: number
  /** How long the play took at the least: the server's clock must have run (nearly) this long. */
  playMs: number
}

const bad = (message = 'Those taps are not valid.') => new GameRuleError('taps', message)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isTime = (value: unknown): value is number => isNumber(value) && value >= 0
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isIndex = (value: unknown, below: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < below

/** The most a play of a cabinet can score. */
export function cabinetMax(cabinet: Cabinet, config: Config): number {
  const games = config.minigames
  switch (cabinet) {
    case 'kick': return 3 + (games.kick.rounds - 1) * 6
    case 'pens': return games.pens.rounds * 2
    case 'keepy': return keepyMax(config)
    case 'keeper': return games.keeper.shots
    case 'pass': return games.pass.rounds
    case 'dribble': return games.dribble.defenders
    case 'targets': return games.targets.count
    case 'cones': return games.cones.rounds
  }
}

/** Runs the scorer, turning a wrong-length play into a refusal rather than a crash. */
function scored(run: () => { total: number, max: number, playMs?: number }, playMs?: number): PlayScore {
  try {
    const result = run()
    return { score: result.total, max: result.max, playMs: playMs ?? result.playMs ?? 0 }
  }
  catch {
    throw bad('That play has the wrong number of taps.')
  }
}

/**
 * Checks what the phone sent for a play of `cabinet` and scores it with the play's seed. Anything that is not the
 * right shape, or that no person could tap, is refused with a `taps` error. Pure: the server and the mock api both
 * use it, and the phone shows the same numbers as it plays.
 */
export function scorePlay(cabinet: Cabinet, seed: string, taps: unknown, config: Config): PlayScore {
  if (!Array.isArray(taps))
    throw bad()
  const { minTapGapMs } = config.minigames

  switch (cabinet) {
    case 'kick':
    case 'pens': {
      if (!taps.every(isTime))
        throw bad()
      if (taps.some(tap => tap < minTapGapMs))
        throw bad('A kick cannot be taken that quickly.')
      const sum = taps.reduce((total, tap) => total + tap, 0)
      return scored(() => (cabinet === 'kick' ? scoreKick(seed, taps, config) : scorePenalties(seed, taps, config)), sum)
    }

    case 'keepy': {
      const minGap = Math.ceil((minTapGapMs * KEEPY_STEPS_PER_SECOND) / 1000)
      const valid = taps.every((tap, index) => isObject(tap) && Number.isInteger(tap.t) && (tap.t as number) >= 0 && isNumber(tap.x) && isNumber(tap.y)
        && (index === 0 || (tap.t as number) - (taps[index - 1] as KeepyTap).t >= minGap))
      if (!valid || taps.length > config.minigames.keepy.maxKicks * 4)
        throw bad()
      const result = runKeepy(seed, taps as KeepyTap[], config)
      return { score: result.score, max: keepyMax(config), playMs: (result.steps * 1000) / KEEPY_STEPS_PER_SECOND }
    }

    case 'keeper': {
      if (!taps.every(dive => dive === null || (isObject(dive) && DIVE_SIDES.includes(dive.side as never) && isTime(dive.ms))))
        throw bad()
      return scored(() => scoreKeeper(seed, taps as Array<KeeperDive | null>, config))
    }

    case 'pass': {
      const { players } = config.minigames.pass
      if (!taps.every(round => Array.isArray(round) && round.length <= config.minigames.pass.start + config.minigames.pass.rounds && round.every(player => isIndex(player, players))))
        throw bad()
      return scored(() => scorePass(seed, taps as number[][], config))
    }

    case 'dribble': {
      const { lanes } = config.minigames.dribble
      let previous: LaneMove = { ms: Number.NEGATIVE_INFINITY, lane: Math.floor(lanes / 2) }
      for (const move of taps) {
        if (!isObject(move) || !isTime(move.ms) || !isIndex(move.lane, lanes) || Math.abs((move.lane as number) - previous.lane) !== 1)
          throw bad()
        if ((move.ms as number) - previous.ms < minTapGapMs)
          throw bad('A move cannot be made that quickly.')
        previous = move as unknown as LaneMove
      }
      return scored(() => scoreDribble(seed, taps as LaneMove[], config))
    }

    case 'targets': {
      if (!taps.every(tap => tap === null || (isObject(tap) && isTime(tap.ms) && isNumber(tap.x) && isNumber(tap.y))))
        throw bad()
      if (taps.some(tap => tap !== null && (tap as TargetTap).ms < minTapGapMs))
        throw bad('A target cannot be hit that quickly.')
      return scored(() => scoreTargets(seed, taps as Array<TargetTap | null>, config))
    }

    case 'cones': {
      if (!taps.every(pick => isIndex(pick, config.minigames.cones.cones)))
        throw bad()
      return scored(() => scoreCones(seed, taps as number[], config))
    }
  }
}
