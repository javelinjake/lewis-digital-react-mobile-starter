import type { AnyTaps, Cabinet, CabinetTaps } from '@ld/pixel-pitch-core'
import type { ComponentType } from 'react'
import { DribbleGame } from './DribbleGame'
import { KeeperGame } from './KeeperGame'
import { KeepyGame } from './KeepyGame'
import { KickTimerGame } from './KickTimerGame'
import { PenaltyGame } from './PenaltyGame'

/** Each cabinet's game. It records what the player did, in that cabinet's shape, and hands it over at the end. */
const GAMES: { [C in Cabinet]: ComponentType<{ seed: string, onFinish: (taps: CabinetTaps[C]) => void }> } = {
  kick: KickTimerGame,
  keepy: KeepyGame,
  pens: PenaltyGame,
  keeper: KeeperGame,
  dribble: DribbleGame,
}

/** The game for `cabinet`. Every game hands over its own cabinet's shape; the union is what the api takes. */
export function cabinetGame(cabinet: Cabinet) {
  return GAMES[cabinet] as ComponentType<{ seed: string, onFinish: (taps: AnyTaps) => void }>
}
