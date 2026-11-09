import type { GameResponse } from '@ld/pixel-pitch-core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { gameKeys } from '../queries/game.keys'

/**
 * Runs one game action. The server's answer is the new club, so it replaces the cached one; matches it played
 * refresh the results list. `optimistic` shows a change (a lineup edit) before the server confirms it.
 */
export function useGameAction<Input, Output extends GameResponse = GameResponse>(run: (input: Input) => Promise<Output>, optimistic?: (current: GameResponse, input: Input) => GameResponse) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onMutate: async (input) => {
      if (!optimistic)
        return { previous: undefined }
      await client.cancelQueries({ queryKey: gameKeys.club() })
      const previous = client.getQueryData<GameResponse | null>(gameKeys.club())
      if (previous)
        client.setQueryData(gameKeys.club(), optimistic(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        client.setQueryData(gameKeys.club(), context.previous)
    },
    onSuccess: (response) => {
      client.setQueryData(gameKeys.club(), response)
      if (response.fixtures.length > 0)
        void client.invalidateQueries({ queryKey: gameKeys.fixtures() })
    },
  })
}
