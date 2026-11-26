import type { Ticket } from './club-state'
import type { GameConfig } from './config'
import { minigamesAt } from './config-minigames'

/**
 * The tuning a play runs on: the games get quicker in each league (`minigamesAt`), and a match moment is a single
 * round of its game. The app draws the game with this and the server replays it with this, so they always agree.
 */
export function playConfig(config: GameConfig, ticket: Pick<Ticket, 'kind' | 'tier'> | null): GameConfig {
  const minigames = minigamesAt(config.minigames, ticket?.tier ?? 1)
  if (ticket?.kind !== 'chance')
    return minigames === config.minigames ? config : { ...config, minigames }
  return {
    ...config,
    minigames: {
      ...minigames,
      kick: { ...minigames.kick, rounds: 1 },
      pens: { ...minigames.pens, rounds: 1 },
      keeper: { ...minigames.keeper, shots: 1 },
    },
  }
}
