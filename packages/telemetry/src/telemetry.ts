import type { ConsentState } from './consent'
import { NO_CONSENT } from './consent'

/** Where product analytics go (PostHog). */
export interface AnalyticsSink {
  capture: (event: string, properties?: Record<string, unknown>) => void
  identify: (userId: string) => void
  reset: () => void
  shutdown: () => void
}

/** Where crashes go (Sentry). */
export interface CrashSink {
  captureError: (error: unknown, context?: Record<string, unknown>) => void
  setUser: (userId: string | null) => void
  shutdown: () => void
}

/** What an `Events` interface must look like: each event maps to its properties, or to `undefined` for none. Accepts interfaces. */
export type EventMap<E> = { [K in keyof E]: Record<string, unknown> | undefined }

export interface TelemetryOptions {
  /** Called only once analytics are agreed to, so the SDK is not even downloaded before that. */
  analytics?: () => Promise<AnalyticsSink>
  crash?: () => Promise<CrashSink>
  consent?: ConsentState
  /**
   * An app that has a lawful basis to collect crash reports without asking (and says so in its privacy policy) can
   * set this. It still stops the moment the person says no.
   */
  crashLegitimateInterest?: boolean
}

export function analyticsAllowed(consent: ConsentState) {
  return consent.analytics
}

export function crashReportsAllowed(consent: ConsentState, legitimateInterest = false) {
  return consent.crashReports || (legitimateInterest && !consent.decided)
}

/**
 * Typed analytics and crash reporting behind consent. `Events` maps each event name to its properties, so a misspelled
 * event or a wrong property is a compile error, and the list of what the app records is in one place.
 */
export function createTelemetry<Events extends EventMap<Events>>(options: TelemetryOptions = {}) {
  let consent = options.consent ?? NO_CONSENT
  let userId: string | null = null
  let analytics: AnalyticsSink | null = null
  let crash: CrashSink | null = null
  let starting: Promise<void> = Promise.resolve()

  function sync() {
    const wantAnalytics = analyticsAllowed(consent)
    const wantCrash = crashReportsAllowed(consent, options.crashLegitimateInterest)

    starting = starting.then(async () => {
      if (wantAnalytics && !analytics && options.analytics) {
        analytics = await options.analytics()
        if (userId)
          analytics.identify(userId)
      }
      else if (!wantAnalytics && analytics) {
        analytics.reset()
        analytics.shutdown()
        analytics = null
      }

      if (wantCrash && !crash && options.crash) {
        crash = await options.crash()
        crash.setUser(userId)
      }
      else if (!wantCrash && crash) {
        crash.shutdown()
        crash = null
      }
    }).catch(() => {
      // A broken analytics SDK must never break the app.
    })
    return starting
  }

  void sync()

  return {
    /** Records an event. Dropped, not queued, when analytics are off: nothing is held back to send later. */
    track<K extends keyof Events & string>(event: K, ...properties: Events[K] extends undefined ? [] : [Events[K]]) {
      analytics?.capture(event, properties[0] as Record<string, unknown> | undefined)
    },

    captureError(error: unknown, context?: Record<string, unknown>) {
      crash?.captureError(error, context)
    },

    /** Link what is recorded to the signed-in account. Use the account id, never an email address. */
    identify(id: string) {
      userId = id
      analytics?.identify(id)
      crash?.setUser(id)
    },

    /** Call on sign-out, so the next person on this device is not linked to the last. */
    reset() {
      userId = null
      analytics?.reset()
      crash?.setUser(null)
    },

    /** Apply a new choice and resolve once the SDKs have started or stopped. */
    setConsent(next: ConsentState) {
      consent = next
      return sync()
    },

    get consent() {
      return consent
    },

    /** Resolves when any pending start or stop has finished. For tests and shutdown. */
    ready: () => starting,
  }
}

export type Telemetry<Events extends EventMap<Events>> = ReturnType<typeof createTelemetry<Events>>
