import type { GameConfig, Player, PlayerLookup } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import { DEFAULT_CONFIG, parseConfig } from '@ld/pixel-pitch-core'

export interface LoadedGame {
  config: GameConfig
  catalogue: Player[]
  players: PlayerLookup
}

const CACHE_MS = 30_000
let cached: { at: number, game: LoadedGame } | undefined

/** Clears the cached config and catalogue. Tests call it after editing either; saves in the admin wait out the cache. */
export function clearGameCache() {
  cached = undefined
}

interface PlayerDoc {
  catalogueId: string
  name: string
  nation: number
  position: Player['position']
  altPosition?: Player['position'] | null
  rarity: Player['rarity']
  rating: number
  sprite: unknown
}

export function toPlayer(doc: PlayerDoc): Player {
  return {
    id: doc.catalogueId,
    name: doc.name,
    nation: doc.nation,
    position: doc.position,
    ...(doc.altPosition ? { altPosition: doc.altPosition } : {}),
    rarity: doc.rarity,
    rating: doc.rating,
    sprite: doc.sprite as Player['sprite'],
  }
}

/** The live config and catalogue, cached briefly: every game action needs both. */
export async function loadGame(payload: Payload, now = Date.now()): Promise<LoadedGame> {
  if (cached && now - cached.at < CACHE_MS)
    return cached.game

  const [global, players] = await Promise.all([
    payload.findGlobal({ slug: 'game-config', depth: 0, overrideAccess: true }),
    payload.find({ collection: 'players', limit: 2000, depth: 0, pagination: false, overrideAccess: true }),
  ])
  const config = global.config ? parseConfig(global.config) : DEFAULT_CONFIG
  const catalogue = players.docs.map(doc => toPlayer(doc as PlayerDoc))
  const byId = new Map(catalogue.map(player => [player.id, player]))
  const game = { config, catalogue, players: (id: string) => byId.get(id) }
  cached = { at: now, game }
  return game
}
