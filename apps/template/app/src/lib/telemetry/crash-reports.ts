import type { ConsentState } from '@ld/telemetry'
import { isNativePlatform } from '@ld/native'
import { createTelemetry, loadConsent, saveConsent } from '@ld/telemetry'
import { sentrySink } from '@ld/telemetry/browser'
import { preferenceStorage } from '@/lib/platform/storage'

/**
 * Crash reports through Sentry, off until the person turns them on in Settings. Needs VITE_SENTRY_DSN (a public
 * key, fine in a VITE_ variable) in a production build; without it Settings shows nothing and no SDK loads. The SDK
 * is downloaded only after consent. Release names are `version+build`, matching the source maps config-vite uploads.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()

export const crashReportsAvailable = Boolean(dsn) && import.meta.env.PROD

export const telemetry = createTelemetry<Record<string, never>>({
  crash: crashReportsAvailable
    ? sentrySink({ dsn: dsn!, release: import.meta.env.VITE_APP_RELEASE, environment: import.meta.env.VITE_APP_ENV, native: isNativePlatform() })
    : undefined,
})

/** Applies the saved choice at launch. */
export async function startCrashReports() {
  if (crashReportsAvailable)
    await telemetry.setConsent(await loadConsent(preferenceStorage))
}

export function crashReportsOn() {
  return telemetry.consent.crashReports
}

export async function setCrashReports(on: boolean) {
  const next: ConsentState = { ...telemetry.consent, crashReports: on, decided: true }
  await saveConsent(preferenceStorage, next)
  await telemetry.setConsent(next)
}
