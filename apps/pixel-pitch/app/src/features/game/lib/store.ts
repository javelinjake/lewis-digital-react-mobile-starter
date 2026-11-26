import type { ClubState } from '@ld/pixel-pitch-core'
import { getPlatform, isNativePlatform } from '@ld/native'
import { configurePurchases, identifyPurchaser, loadPurchaseOptions, purchase, restorePurchases } from '@ld/native/purchases'

/**
 * Where purchases go. `store`: Apple or Google, through RevenueCat, and the server pays the club when RevenueCat
 * reports it. `pretend`: the mock data build pays at once, for development and playtests. `unavailable`: the web, where
 * the store is not available, and a native build without a RevenueCat key.
 */
export type StoreMode = 'store' | 'pretend' | 'unavailable'

function storeKey() {
  const platform = getPlatform()
  return platform === 'ios' ? import.meta.env.VITE_REVENUECAT_IOS_KEY : platform === 'android' ? import.meta.env.VITE_REVENUECAT_ANDROID_KEY : undefined
}

export function storeMode(): StoreMode {
  if (import.meta.env.VITE_DATA_MODE !== 'live')
    return 'pretend'
  return isNativePlatform() && storeKey() ? 'store' : 'unavailable'
}

let configuredFor: string | null = null

/** Configures RevenueCat for the signed-in account. Its app user id must be the backend user id, or nothing is paid. */
async function ready(userId: string) {
  if (configuredFor === userId)
    return
  if (configuredFor === null)
    await configurePurchases(storeKey() ?? '', userId)
  else
    await identifyPurchaser(userId)
  configuredFor = userId
}

export interface StorePrice {
  optionId: string
  /** Formatted by the store in the buyer's currency. */
  price: string
}

/** The store's prices, by product id. Products the store does not offer are missing. */
export async function loadStorePrices(userId: string): Promise<Map<string, StorePrice>> {
  if (storeMode() !== 'store')
    return new Map()
  await ready(userId)
  const options = await loadPurchaseOptions()
  return new Map(options.map(option => [option.productId, { optionId: option.id, price: option.price }]))
}

export async function buyFromStore(userId: string, optionId: string) {
  await ready(userId)
  return purchase(optionId)
}

export async function restoreFromStore(userId: string) {
  await ready(userId)
  return restorePurchases()
}

/** What a purchase changes, so the app can tell when the server has paid one. */
export function purchaseMark(state: ClubState) {
  return [state.idle.gems, state.idle.passSeason, state.perks.licence, state.starterOffer.bought, state.signings.pending].join('|')
}
