import type { Ticket } from './club-state'
import type { GameConfig } from './config'
import { minigamesAt } from './config-minigames'

/**
 * The tuning a play runs on: the games get quicker in each league (`minigamesAt`), and a match moment is a single
 * round of its game. The app draws the game with this and the server replays it with this, so they always agree.
 */
export function playConfig(config: GameConfig, ticket: Pick<Ticket, 'kind' | 'tier'> | null): GameConfig {
  if (ticket?.kind === 'challenge')
    return { ...config, minigames: endlessMinigames(config) }
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

/**
 * The daily challenge's tuning: every game endless, speeding up until nobody could keep up, at League 5's pace for
 * everyone (the leaderboard compares players in every league). Every player gets the same pattern from the day's seed.
 */
export function endlessMinigames(config: GameConfig): GameConfig['minigames'] {
  const { minigames } = config
  const endless = config.challenge.endless
  return {
    ...minigames,
    endless: true,
    kick: { ...minigames.kick, rounds: endless.kickRounds, ramp: endless.kickRamp },
    pens: { ...minigames.pens, rounds: endless.pensRounds, lastPace: endless.pensLastPace },
    keeper: { ...minigames.keeper, shots: endless.keeperShots, lastWindowMs: endless.keeperLastWindowMs },
    keepy: { ...minigames.keepy, maxKicks: 100_000, maxSeconds: endless.keepySeconds },
    dribble: { ...minigames.dribble, defenders: endless.dribbleDefenders, lastGapMs: endless.dribbleLastGapMs, lastFallMs: endless.dribbleLastFallMs },
  }
}
