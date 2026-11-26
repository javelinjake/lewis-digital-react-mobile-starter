import type { GameConfig, GameResponse, Player } from '@ld/pixel-pitch-core'
import { DEFAULT_CONFIG, parseConfig, upgradeState } from '@ld/pixel-pitch-core'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { gameApi } from '../api/game-api'
import { gameKeys } from './game.keys'

/**
 * The club, caught up to now. Kept in the persisted cache, so the last known club shows at once (and offline) while
 * a fresh sync runs. `null` means no club yet: onboarding.
 */
export function useClub() {
  return useQuery<GameResponse | null>({
    queryKey: gameKeys.club(),
    queryFn: gameApi.sync,
    staleTime: 30_000,
    select: upgradeCached,
  })
}

/**
 * The club in the persisted cache can be from an older version of the app, without fields added since: it is shown
 * at once on opening, before the sync answers. It goes through `upgradeState`, as the server does with a saved club,
 * so a screen never reads a field that is not there.
 */
function upgradeCached(game: GameResponse | null): GameResponse | null {
  if (!game)
    return game
  const state = upgradeState(game.club.state, DEFAULT_CONFIG)
  return state === game.club.state ? game : { ...game, club: { ...game.club, state } }
}

export function useCatalogue() {
  const query = useQuery<Player[]>({ queryKey: gameKeys.catalogue(), queryFn: gameApi.readCatalogue, staleTime: 60 * 60_000 })
  const lookup = useMemo(() => {
    const byId = new Map((query.data ?? []).map(player => [player.id, player]))
    return (id: string) => byId.get(id)
  }, [query.data])
  return { ...query, lookup }
}

/** The live config, or the built-in defaults until it arrives. */
/**
 * The game's numbers. The answer is kept in the persisted cache, so after an update the first one seen can be from
 * the old version, without settings added since. It goes through the schema again here, which fills those with their
 * defaults, so a new game never reads a number that is not there.
 */
export function useGameConfig(): GameConfig {
  const query = useQuery<GameConfig>({ queryKey: gameKeys.config(), queryFn: gameApi.readConfig, staleTime: 10 * 60_000 })
  return useMemo(() => {
    if (!query.data)
      return DEFAULT_CONFIG
    try {
      return parseConfig(query.data)
    }
    catch {
      return DEFAULT_CONFIG
    }
  }, [query.data])
}

export function useFixtures(limit = 10) {
  return useQuery({ queryKey: [...gameKeys.fixtures(), limit], queryFn: () => gameApi.readFixtures(limit) })
}
