import { ScreenOrientation } from '@capacitor/screen-orientation'
import { isNativePlatform } from './platform'

export type OrientationLock = 'portrait' | 'landscape' | 'any'

/** Locks the screen while the app runs. The store build is also locked in the native project (Trapeze). */
export async function lockOrientation(orientation: OrientationLock) {
  if (!isNativePlatform())
    return
  try {
    if (orientation === 'any')
      await ScreenOrientation.unlock()
    else
      await ScreenOrientation.lock({ orientation })
  }
  catch {
    // Some devices refuse. The native project setting still applies.
  }
}
