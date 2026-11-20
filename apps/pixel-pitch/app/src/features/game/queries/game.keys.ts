export const gameKeys = {
  all: ['game'] as const,
  club: () => [...gameKeys.all, 'club'] as const,
  fixtures: () => [...gameKeys.all, 'fixtures'] as const,
  catalogue: () => ['catalogue'] as const,
  config: () => ['game-config'] as const,
}
