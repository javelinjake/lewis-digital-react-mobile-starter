import type { FixtureResult, GameResponse, Player } from '@ld/pixel-pitch-core'
import type { GameApi } from './game-api.types'
import { isApiError, newIdempotencyKey } from '@ld/api-client'
import { DEFAULT_CONFIG, parseConfig } from '@ld/pixel-pitch-core'
import { getApi } from '@/lib/api/client'

interface PlayerDoc {
  id: number
  catalogueId: string
  name: string
  nation: number
  position: Player['position']
  altPosition?: Player['position'] | null
  rarity: Player['rarity']
  rating: number
  sprite: Player['sprite']
}

type FixtureDoc = FixtureResult & { id: number }

/** Every tap gets its own key, so a retried request is applied once. */
function act(path: string, body: Record<string, unknown> = {}) {
  return getApi().action<GameResponse>(path, body, newIdempotencyKey())
}

export const gameApi: GameApi = {
  async sync() {
    try {
      return await act('/game/sync')
    }
    catch (error) {
      if (isApiError(error) && error.status === 404)
        return null
      throw error
    }
  },
  createClub: input => act('/game/club', { ...input }),
  setLineup: (formation, lineup) => act('/game/lineup', { formation, lineup }),
  sell: cardId => act('/game/sell', { cardId }),
  merge: cardIds => act('/game/merge', { cardIds }),
  train: cardId => act('/game/train', { cardId }),
  async readCatalogue() {
    const result = await getApi().collection<PlayerDoc>('players').find({ limit: 1000, depth: 0 })
    return result.docs.map(doc => ({
      id: doc.catalogueId,
      name: doc.name,
      nation: doc.nation,
      position: doc.position,
      ...(doc.altPosition ? { altPosition: doc.altPosition } : {}),
      rarity: doc.rarity,
      rating: doc.rating,
      sprite: doc.sprite,
    }))
  },
  async readConfig() {
    const global = await getApi().request<{ config?: unknown }>('/api/globals/game-config')
    return global.config ? parseConfig(global.config) : DEFAULT_CONFIG
  },
  async readFixtures(limit) {
    const result = await getApi().collection<FixtureDoc>('fixtures').find({ sort: '-no', limit, depth: 0 })
    return result.docs
  },
}
