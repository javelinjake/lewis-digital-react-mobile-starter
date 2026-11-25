import { AppUpdate, AppUpdateAvailability, AppUpdateResultCode } from '@capawesome/capacitor-app-update'
import { isAndroid, isNativePlatform } from './platform'

export interface StoreUpdateInfo {
  /** `unknown` covers no network, an app not yet in the store, and the web. */
  status: 'available' | 'current' | 'unknown'
  currentVersion?: string
  availableVersion?: string
  /** Android only: Play can download and install the update inside the app. */
  inAppUpdateAllowed: boolean
}

const unknown: StoreUpdateInfo = { status: 'unknown', inAppUpdateAllowed: false }

/**
 * Asks the App Store or Play whether a newer version of this app is published. Use it to nudge users off a version
 * the api no longer supports. Never throws.
 */
export async function checkStoreUpdate(): Promise<StoreUpdateInfo> {
  if (!isNativePlatform())
    return unknown
  try {
    const info = await AppUpdate.getAppUpdateInfo()
    const status = info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
      ? 'available'
      : info.updateAvailability === AppUpdateAvailability.UPDATE_NOT_AVAILABLE ? 'current' : 'unknown'
    return {
      status,
      currentVersion: info.currentVersionName,
      availableVersion: info.availableVersionName,
      inAppUpdateAllowed: isAndroid() && info.immediateUpdateAllowed === true,
    }
  }
  catch {
    return unknown
  }
}

/** Opens this app's page in the App Store or Play. No-op on the web. */
export async function openStorePage(): Promise<void> {
  if (!isNativePlatform())
    return
  await AppUpdate.openAppStore().catch(() => undefined)
}

/**
 * Android: downloads and installs the update in a full-screen Play flow, then restarts the app. Elsewhere, or when
 * Play does not allow it, opens the store page instead.
 */
export async function installStoreUpdate(): Promise<'started' | 'cancelled' | 'store-opened'> {
  const info = await checkStoreUpdate()
  if (!info.inAppUpdateAllowed) {
    await openStorePage()
    return 'store-opened'
  }
  try {
    const { code } = await AppUpdate.performImmediateUpdate()
    return code === AppUpdateResultCode.OK ? 'started' : 'cancelled'
  }
  catch {
    await openStorePage()
    return 'store-opened'
  }
}
