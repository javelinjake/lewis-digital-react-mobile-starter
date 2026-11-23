import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { isNativePlatform } from './platform'

/**
 * Live updates of the web bundle (OTA) through `@capgo/capacitor-updater`, served by the app's own api
 * (`/api/ota/check`, see docs/ota.md). Needs `capabilities.ota` in app.meta.ts and the plugin in the app's
 * package.json. The plugin checks in the background, downloads, and switches to the new bundle the next time the
 * app goes to the background, so nobody sees an "updating" screen.
 *
 * Import this entry lazily, from code that runs only when the capability is on.
 */

/**
 * Tells the updater this bundle started properly. Call it once the first screen has rendered. A bundle that does not
 * call it within the timeout (10 s, set in capacitor.config) is marked broken and the app goes back to the last good
 * one on the next launch, which is what makes a bad live update safe. No-op on the web. Never throws.
 */
export async function markAppReady(): Promise<void> {
  if (!isNativePlatform())
    return
  await CapacitorUpdater.notifyAppReady().catch(() => undefined)
}

export interface RunningBundle {
  /** `builtin` for the bundle shipped in the store build, otherwise the live update's `version+build`. */
  version: string
  /** The store version of the installed shell. */
  native: string
}

/** Which bundle is running, for a settings or support screen. Null on the web. */
export async function getRunningBundle(): Promise<RunningBundle | null> {
  if (!isNativePlatform())
    return null
  try {
    const { bundle, native } = await CapacitorUpdater.current()
    return { version: bundle.version, native }
  }
  catch {
    return null
  }
}
