import type { GameConfig, GameResponse, Player } from '@ld/pixel-pitch-core'
import { DEFAULT_CONFIG } from '@ld/pixel-pitch-core'
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
  })
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
export function useGameConfig(): GameConfig {
  const query = useQuery<GameConfig>({ queryKey: gameKeys.config(), queryFn: gameApi.readConfig, staleTime: 10 * 60_000 })
  return query.data ?? DEFAULT_CONFIG
}

export function useFixtures(limit = 10) {
  return useQuery({ queryKey: [...gameKeys.fixtures(), limit], queryFn: () => gameApi.readFixtures(limit) })
}
