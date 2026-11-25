import type { ConsentState } from '@ld/telemetry'
import { isNativePlatform } from '@ld/native'
import { createTelemetry, loadConsent, saveConsent } from '@ld/telemetry'
import { postHogSink, sentrySink } from '@ld/telemetry/browser'
import { preferenceStorage } from '@/lib/platform/storage'

/**
 * Everything the game records, in one place. These are what the soft launch is read from: where new players drop
 * out of the first session, how often they come back, and what they look at and buy in the shop. Nothing is sent
 * until the player agrees, and nothing names them: events are linked to the account id only.
 */
export interface GameEvents {
  session_started: undefined
  club_founded: undefined
  first_step_done: { step: string }
  pack_opened: { source: string }
  match_viewed: { no: number }
  arcade_played: { cabinet: string, paid: boolean }
  shop_viewed: { from: string }
  purchase_started: { product: string }
  purchase_completed: { product: string }
  purchase_cancelled: { product: string }
  gems_spent: { on: string, amount: number }
  pass_tier_claimed: { track: string, tier: number }
  signing_chosen: undefined
}

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
const postHogKey = import.meta.env.VITE_POSTHOG_KEY?.trim()

/** Crash reports need a Sentry DSN (public) in a production build; without it Settings shows nothing and no SDK loads. */
export const crashReportsAvailable = Boolean(dsn) && import.meta.env.PROD
/** Usage analytics need a PostHog project key (public); without it nothing is recorded or asked for. */
export const analyticsAvailable = Boolean(postHogKey)

/**
 * One telemetry for the app: product analytics (PostHog) and crash reports (Sentry), each a separate choice and each
 * off until the person turns it on. The SDKs are downloaded only after consent. Release names are `version+build`,
 * matching the source maps config-vite uploads.
 */
export const telemetry = createTelemetry<GameEvents>({
  analytics: analyticsAvailable ? postHogSink({ key: postHogKey! }) : undefined,
  crash: crashReportsAvailable
    ? sentrySink({ dsn: dsn!, release: import.meta.env.VITE_APP_RELEASE, environment: import.meta.env.VITE_APP_ENV, native: isNativePlatform() })
    : undefined,
})

/** Applies the saved choices at launch. */
export async function startTelemetry() {
  if (crashReportsAvailable || analyticsAvailable)
    await telemetry.setConsent(await loadConsent(preferenceStorage))
}

async function choose(change: Partial<ConsentState>) {
  const next: ConsentState = { ...telemetry.consent, ...change, decided: true }
  await saveConsent(preferenceStorage, next)
  await telemetry.setConsent(next)
}

export const setAnalyticsConsent = (analytics: boolean) => choose({ analytics })
export const setCrashReports = (crashReports: boolean) => choose({ crashReports })
export const crashReportsOn = () => telemetry.consent.crashReports
