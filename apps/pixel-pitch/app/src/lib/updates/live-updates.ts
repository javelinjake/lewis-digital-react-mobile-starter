import { isNativePlatform } from '@ld/native'
import { appMeta } from '../../../app.meta'

/**
 * Live updates (OTA). Off until `capabilities.ota` is on in app.meta.ts (docs/ota.md). `@ld/native/updates` is
 * loaded only when it is on, so an app without live updates never bundles the updater.
 */
export const liveUpdatesOn = Boolean((appMeta.capabilities as { ota?: boolean }).ota) && isNativePlatform()

/** Call once the first screen is up. A live bundle that never gets here is rolled back on the next launch. */
export function reportAppReady() {
  if (liveUpdatesOn)
    void import('@ld/native/updates').then(({ markAppReady }) => markAppReady())
}
