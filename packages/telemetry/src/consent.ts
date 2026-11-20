/**
 * What the person has agreed to. Analytics and crash reports are separate choices, both off until they say yes.
 * `decided` is false until they have seen the choice, so the app knows when to ask.
 */
export interface ConsentState {
  analytics: boolean
  crashReports: boolean
  decided: boolean
}

export const NO_CONSENT: ConsentState = { analytics: false, crashReports: false, decided: false }

interface StringStore {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
}

const KEY = 'telemetry-consent'

export async function loadConsent(store: StringStore): Promise<ConsentState> {
  try {
    const raw = await store.get(KEY)
    if (!raw)
      return NO_CONSENT
    const parsed = JSON.parse(raw) as Partial<ConsentState>
    return { analytics: parsed.analytics === true, crashReports: parsed.crashReports === true, decided: parsed.decided === true }
  }
  catch {
    return NO_CONSENT
  }
}

export async function saveConsent(store: StringStore, consent: ConsentState) {
  await store.set(KEY, JSON.stringify({ ...consent, decided: true }))
}
