import type { Player } from './catalogue'
import type { GameConfig } from './config'
import type { Position, Rarity } from './positions'
import { createRng, type Rng } from '@ld/utils/random/rng'
import { RARITIES } from './positions'

/** Odds for a league tier. Tier 1 is League 5; tiers past the table (League 1 and the Prestige tiers) use the last row. */
export function oddsForTier(tier: number, config: GameConfig): number[] {
  const rows = config.packs.oddsByLeague
  return rows[Math.min(Math.max(1, tier), rows.length) - 1]
}

const STAR_INDEX = RARITIES.indexOf('star')

export function isStarOrBetter(rarity: Rarity) {
  return RARITIES.indexOf(rarity) >= STAR_INDEX
}

export interface PackRoll {
  players: Player[]
  /** Players since the last Star or better, to store for the next pack. */
  pityAfter: number
  /** Whether each player was handed out by the guarantee instead of by chance. */
  guaranteed: boolean[]
}

export interface RollPackInput {
  catalogue: readonly Player[]
  /** League tier of the club (1 is League 5). */
  tier: number
  /** Players opened since the last Star or better. */
  pity: number
  seed: number | string
  config: GameConfig
  /** An Arcade pack lets the player choose a position. Players in it are `config.packs.positionBoost` times as likely. */
  position?: Position
}

function rollRarity(rng: Rng, odds: readonly number[], onlyStarUp: boolean): Rarity {
  if (!onlyStarUp)
    return RARITIES[rng.weighted(odds)]
  // The guarantee picks between Star and Legend in proportion to their odds.
  return RARITIES[STAR_INDEX + rng.weighted(odds.slice(STAR_INDEX))]
}

/**
 * Rolls a pack. Each player's rarity follows the league's odds, except that a Star or better is guaranteed within
 * `pityPlayers` players, so a long dry spell always ends. Seeded, so the app can show what the server rolled.
 */
export function rollPack(input: RollPackInput): PackRoll {
  const { catalogue, tier, seed, config, position } = input
  const rng = createRng(seed)
  const odds = oddsForTier(tier, config)
  let pity = input.pity

  const byRarity = new Map<Rarity, Player[]>(RARITIES.map(rarity => [rarity, catalogue.filter(player => player.rarity === rarity)]))
  const players: Player[] = []
  const guaranteed: boolean[] = []

  for (let slot = 0; slot < config.shelf.playersPerPack; slot++) {
    const forced = pity >= config.packs.pityPlayers - 1
    const rarity = rollRarity(rng, odds, forced)
    const pool = byRarity.get(rarity) ?? []
    if (pool.length === 0)
      throw new Error(`The catalogue has no ${rarity} players.`)

    const weights = pool.map(player => (position && player.position === position ? config.packs.positionBoost : 1))
    players.push(pool[rng.weighted(weights)])
    guaranteed.push(forced)
    pity = isStarOrBetter(rarity) ? 0 : pity + 1
  }

  return { players, pityAfter: pity, guaranteed }
}
