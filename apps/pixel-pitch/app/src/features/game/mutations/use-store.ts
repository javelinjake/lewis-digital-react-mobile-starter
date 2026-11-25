import type { GameResponse } from '@ld/pixel-pitch-core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { telemetry } from '@/lib/telemetry'
import { useAuthStore } from '@/stores/auth.store'
import { gameApi } from '../api/game-api'
import { buyFromStore, loadStorePrices, purchaseMark, restoreFromStore, storeMode } from '../lib/store'
import { gameKeys } from '../queries/game.keys'

const CONFIRM_TRIES = 10
const CONFIRM_GAP_MS = 2000

/** The store's own prices (in the buyer's currency), by product id. Empty where there is no store. */
export function useStorePrices() {
  const userId = useAuthStore(state => state.userId)
  return useQuery({
    queryKey: [...gameKeys.all, 'store-prices', userId],
    queryFn: () => loadStorePrices(userId ?? ''),
    enabled: storeMode() === 'store' && userId !== null,
    staleTime: 10 * 60_000,
  })
}

export type BuyOutcome = 'paid' | 'confirming' | 'cancelled'

/**
 * Buys a product. With the real store, the store takes the money and RevenueCat tells the server, which pays the club;
 * the app syncs until it sees the change (or says it is on its way). The mock build pays at once.
 */
export function useBuy() {
  const client = useQueryClient()
  const userId = useAuthStore(state => state.userId)
  const prices = useStorePrices()

  return useMutation({
    mutationFn: async (productId: string): Promise<BuyOutcome> => {
      telemetry.track('purchase_started', { product: productId })
      if (storeMode() === 'pretend') {
        const response = await gameApi.pretendPurchase!(productId)
        client.setQueryData(gameKeys.club(), response)
        telemetry.track('purchase_completed', { product: productId })
        return 'paid'
      }
      const option = prices.data?.get(productId)
      if (!option || !userId)
        throw new Error('That is not on sale in the store right now. Try again later.')
      const before = client.getQueryData<GameResponse | null>(gameKeys.club())
      const result = await buyFromStore(userId, option.optionId)
      if (result === 'cancelled') {
        telemetry.track('purchase_cancelled', { product: productId })
        return 'cancelled'
      }
      telemetry.track('purchase_completed', { product: productId })
      const mark = before ? purchaseMark(before.club.state) : null
      for (let attempt = 0; attempt < CONFIRM_TRIES; attempt++) {
        await new Promise(resolve => setTimeout(resolve, CONFIRM_GAP_MS))
        const synced = await gameApi.sync()
        if (synced) {
          client.setQueryData(gameKeys.club(), synced)
          if (purchaseMark(synced.club.state) !== mark)
            return 'paid'
        }
      }
      return 'confirming'
    },
  })
}

/** Apple and Google require a visible way to restore purchases. Everything this game sells is kept on the club, so this re-checks the store and syncs. */
export function useRestore() {
  const client = useQueryClient()
  const userId = useAuthStore(state => state.userId)
  return useMutation({
    mutationFn: async () => {
      if (storeMode() === 'store' && userId)
        await restoreFromStore(userId)
      const synced = await gameApi.sync()
      if (synced)
        client.setQueryData(gameKeys.club(), synced)
    },
  })
}
