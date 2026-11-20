import type { CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { Purchases } from '@revenuecat/purchases-capacitor'
import { isNativePlatform } from './platform'

export interface PurchaseOption {
  /** RevenueCat's package id, passed back to `purchase`. */
  id: string
  /** The store product id, e.g. `club_pass_monthly`. */
  productId: string
  title: string
  /** Already formatted in the store's currency, e.g. "£3.99". Never format prices yourself. */
  price: string
}

export type PurchaseResult = 'purchased' | 'cancelled'

const packages = new Map<string, PurchasesPackage>()

/** Call once at startup with the public SDK key for the platform. Not a secret. */
export async function configurePurchases(apiKey: string, appUserId?: string) {
  if (!isNativePlatform() || !apiKey)
    return false
  await Purchases.configure({ apiKey, appUserID: appUserId ?? null })
  return true
}

/**
 * Tie purchases to the signed-in account. The id MUST be the backend user id: the RevenueCat webhook looks the
 * account up by it, so any other value grants nothing.
 */
export async function identifyPurchaser(userId: string) {
  if (!isNativePlatform())
    return
  await Purchases.logIn({ appUserID: userId })
}

export async function resetPurchaser() {
  if (!isNativePlatform())
    return
  await Purchases.logOut().catch(() => undefined)
}

export async function loadPurchaseOptions(): Promise<PurchaseOption[]> {
  if (!isNativePlatform())
    return []
  const { current } = await Purchases.getOfferings()
  packages.clear()
  return (current?.availablePackages ?? []).map((item) => {
    packages.set(item.identifier, item)
    return { id: item.identifier, productId: item.product.identifier, title: item.product.title, price: item.product.priceString }
  })
}

export async function purchase(optionId: string): Promise<PurchaseResult> {
  const aPackage = packages.get(optionId)
  if (!aPackage)
    throw new Error('Load the purchase options before buying.')

  try {
    await Purchases.purchasePackage({ aPackage })
    return 'purchased'
  }
  catch (error) {
    if ((error as { userCancelled?: boolean }).userCancelled)
      return 'cancelled'
    throw error
  }
}

function activeEntitlements(info: CustomerInfo) {
  return Object.keys(info.entitlements.active)
}

/** Apple and Google both require a visible way to restore. Returns the entitlements now active. */
export async function restorePurchases() {
  if (!isNativePlatform())
    return []
  const { customerInfo } = await Purchases.restorePurchases()
  return activeEntitlements(customerInfo)
}

/** The store's own subscription page, for "Manage subscription". Open it with a normal link; null when there is none. */
export async function getManageSubscriptionsUrl(): Promise<string | null> {
  if (!isNativePlatform())
    return null
  const { customerInfo } = await Purchases.getCustomerInfo()
  return customerInfo.managementURL
}
