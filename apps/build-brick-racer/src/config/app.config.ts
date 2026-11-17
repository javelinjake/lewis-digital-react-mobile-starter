export const appConfig = {
  name: 'Build Brick Racer',
  projectId: 'build-brick-racer',
  /** Replay storage budget in bytes (100 MB). Oldest unpinned replay data goes first. */
  replayBudgetBytes: 100 * 1024 * 1024,
} as const
