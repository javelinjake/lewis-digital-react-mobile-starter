import type { ConsentState } from '@ld/telemetry'
import { createKeyValueStorage } from '@ld/native'
import { createTelemetry, loadConsent, saveConsent } from '@ld/telemetry'
import { postHogSink } from '@ld/telemetry/browser'

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

const storage = createKeyValueStorage('pp')
const key = import.meta.env.VITE_POSTHOG_KEY

export const telemetry = createTelemetry<GameEvents>({
  analytics: key ? postHogSink({ key }) : undefined,
})

/** Restores the player's earlier choice. Until they choose, nothing is recorded. */
export async function startTelemetry() {
  await telemetry.setConsent(await loadConsent(storage))
}

export async function setAnalyticsConsent(analytics: boolean) {
  const next: ConsentState = { analytics, crashReports: telemetry.consent.crashReports, decided: true }
  await saveConsent(storage, next)
  await telemetry.setConsent(next)
}
