import type { AnalyticsSink, CrashSink } from './telemetry'

/**
 * The real PostHog and Sentry SDKs, loaded on demand: they are not part of the first download and are fetched only
 * after the person agrees. Pass these as the `analytics` and `crash` options of `createTelemetry`.
 */
export interface PostHogConfig {
  key: string
  /** EU cloud by default, so data stays in Europe. */
  host?: string
}

export function postHogSink(config: PostHogConfig): () => Promise<AnalyticsSink> {
  return async () => {
    const { default: posthog } = await import('posthog-js')
    posthog.init(config.key, {
      api_host: config.host ?? 'https://eu.i.posthog.com',
      // Events are sent by name, from the typed map. Nothing is captured automatically.
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
      persistence: 'localStorage',
    })
    return {
      capture: (event, properties) => posthog.capture(event, properties),
      identify: id => posthog.identify(id),
      reset: () => posthog.reset(),
      shutdown: () => posthog.opt_out_capturing(),
    }
  }
}

export interface SentryConfig {
  dsn: string
  /** `version+build`, so a crash points at one release and its source maps. */
  release: string
  environment: string
  /** True inside the Capacitor shell: also reports native crashes. */
  native?: boolean
}

export function sentrySink(config: SentryConfig): () => Promise<CrashSink> {
  return async () => {
    const Sentry = await import('@sentry/react')
    const options = {
      dsn: config.dsn,
      release: config.release,
      environment: config.environment,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
    }

    if (config.native) {
      const { init } = await import('@sentry/capacitor')
      init(options, Sentry.init)
    }
    else {
      Sentry.init(options)
    }

    return {
      captureError: (error, context) => Sentry.captureException(error, { extra: context }),
      setUser: id => Sentry.setUser(id ? { id } : null),
      shutdown: () => void Sentry.close(),
    }
  }
}
