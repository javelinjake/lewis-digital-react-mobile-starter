import type { GameConfig } from '@ld/pixel-pitch-core'
import { createContext, use } from 'react'
import { useGameConfig } from './use-game'

/** The tuning of the play on screen, set by `PlayTuning`. */
export const PlayConfigContext = createContext<GameConfig | null>(null)

/** The config a game draws itself with: the ticket's tuning inside `PlayTuning`, else the live config. */
export function usePlayConfig(): GameConfig {
  const tuned = use(PlayConfigContext)
  const config = useGameConfig()
  return tuned ?? config
}
