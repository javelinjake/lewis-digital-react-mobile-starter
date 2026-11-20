import type { Claimed } from '../components/ClaimedPop'
import { useToast } from '@ld/ui'
import { useState } from 'react'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { ClaimedPop } from '../components/ClaimedPop'
import { useGameAction } from './use-game-action'

/**
 * Claim everything that is waiting in one call, then show what it paid. `pop` goes somewhere that stays on screen:
 * once everything is taken the list that held the button is gone, and the pop-up must not go with it.
 */
export function useClaimAll() {
  const toast = useToast()
  const [done, setDone] = useState<Claimed | null>(null)
  const mutation = useGameAction(() => gameApi.claimAll())
  return {
    claim: (after?: () => void) => mutation.mutate(undefined, {
      onSuccess: (response) => {
        setDone(response)
        after?.()
      },
      onError: error => toast.push(formatError(error), 'error'),
    }),
    pending: mutation.isPending,
    pop: done ? <ClaimedPop result={done} onClose={() => setDone(null)} /> : null,
  }
}
