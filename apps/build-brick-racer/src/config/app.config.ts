import { gameConfig } from './game.config'

export const appConfig = {
  name: 'Build Brick Racer',
  projectId: 'build-brick-racer',
  /** Replay storage budget in bytes. Oldest unpinned replay data goes first. */
  replayBudgetBytes: gameConfig.replayStorageBudgetMB * 1024 * 1024,
} as const
