import type { ConsentState } from '../src'
import { describe, expect, it, vi } from 'vitest'
import { analyticsAllowed, crashReportsAllowed, createTelemetry, loadConsent, NO_CONSENT, saveConsent } from '../src'

interface Events {
  pack_opened: { rarity: string }
  session_start: undefined
}

const yes: ConsentState = { analytics: true, crashReports: true, decided: true }

function sinks() {
  const analytics = { capture: vi.fn(), identify: vi.fn(), reset: vi.fn(), shutdown: vi.fn() }
  const crash = { captureError: vi.fn(), setUser: vi.fn(), shutdown: vi.fn() }
  const startAnalytics = vi.fn(async () => analytics)
  const startCrash = vi.fn(async () => crash)
  return { analytics, crash, startAnalytics, startCrash, options: { analytics: startAnalytics, crash: startCrash } }
}

describe('consent rules', () => {
  it('allows analytics only when the person agreed', () => {
    expect(analyticsAllowed(NO_CONSENT)).toBe(false)
    expect(analyticsAllowed(yes)).toBe(true)
  })

  it('allows crash reports on consent, or on legitimate interest until the person decides otherwise', () => {
    expect(crashReportsAllowed(NO_CONSENT)).toBe(false)
    expect(crashReportsAllowed(NO_CONSENT, true)).toBe(true)
    expect(crashReportsAllowed({ analytics: false, crashReports: false, decided: true }, true)).toBe(false)
    expect(crashReportsAllowed(yes)).toBe(true)
  })
})

describe('createTelemetry', () => {
  it('does not even load the SDKs, and records nothing, before consent', async () => {
    const { options, startAnalytics, startCrash, analytics, crash } = sinks()
    const telemetry = createTelemetry<Events>(options)
    await telemetry.ready()

    telemetry.track('pack_opened', { rarity: 'star' })
    telemetry.captureError(new Error('boom'))

    expect(startAnalytics).not.toHaveBeenCalled()
    expect(startCrash).not.toHaveBeenCalled()
    expect(analytics.capture).not.toHaveBeenCalled()
    expect(crash.captureError).not.toHaveBeenCalled()
  })

  it('records events once analytics are agreed to', async () => {
    const { options, analytics } = sinks()
    const telemetry = createTelemetry<Events>(options)
    await telemetry.setConsent(yes)

    telemetry.track('pack_opened', { rarity: 'star' })
    telemetry.track('session_start')

    expect(analytics.capture).toHaveBeenCalledWith('pack_opened', { rarity: 'star' })
    expect(analytics.capture).toHaveBeenCalledWith('session_start', undefined)
  })

  it('does not replay what happened before consent', async () => {
    const { options, analytics } = sinks()
    const telemetry = createTelemetry<Events>(options)
    telemetry.track('pack_opened', { rarity: 'legend' })
    await telemetry.setConsent(yes)
    expect(analytics.capture).not.toHaveBeenCalled()
  })

  it('treats the two choices separately', async () => {
    const { options, startAnalytics, startCrash } = sinks()
    const telemetry = createTelemetry<Events>(options)
    await telemetry.setConsent({ analytics: false, crashReports: true, decided: true })
    expect(startAnalytics).not.toHaveBeenCalled()
    expect(startCrash).toHaveBeenCalledTimes(1)
  })

  it('stops and forgets the person as soon as consent is withdrawn', async () => {
    const { options, analytics, crash } = sinks()
    const telemetry = createTelemetry<Events>(options)
    await telemetry.setConsent(yes)
    await telemetry.setConsent({ analytics: false, crashReports: false, decided: true })

    expect(analytics.reset).toHaveBeenCalled()
    expect(analytics.shutdown).toHaveBeenCalled()
    expect(crash.shutdown).toHaveBeenCalled()

    telemetry.track('pack_opened', { rarity: 'pro' })
    expect(analytics.capture).not.toHaveBeenCalled()
  })

  it('starts each SDK once however often consent is applied', async () => {
    const { options, startAnalytics } = sinks()
    const telemetry = createTelemetry<Events>(options)
    await telemetry.setConsent(yes)
    await telemetry.setConsent(yes)
    expect(startAnalytics).toHaveBeenCalledTimes(1)
  })

  it('collects crash reports without asking only when the app declares a legitimate interest', async () => {
    const { options, startCrash, startAnalytics } = sinks()
    createTelemetry<Events>({ ...options, crashLegitimateInterest: true })
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(startCrash).toHaveBeenCalledTimes(1)
    expect(startAnalytics).not.toHaveBeenCalled()
  })

  it('links events to the account, including one signed in before consent, and unlinks on reset', async () => {
    const { options, analytics, crash } = sinks()
    const telemetry = createTelemetry<Events>(options)
    telemetry.identify('42')
    await telemetry.setConsent(yes)
    expect(analytics.identify).toHaveBeenCalledWith('42')
    expect(crash.setUser).toHaveBeenCalledWith('42')

    telemetry.reset()
    expect(analytics.reset).toHaveBeenCalled()
    expect(crash.setUser).toHaveBeenLastCalledWith(null)
  })

  it('survives an SDK that fails to load', async () => {
    const telemetry = createTelemetry<Events>({ analytics: async () => { throw new Error('blocked by an ad blocker') } })
    await expect(telemetry.setConsent(yes)).resolves.toBeUndefined()
    expect(() => telemetry.track('session_start')).not.toThrow()
  })
})

describe('stored consent', () => {
  const memory = () => {
    const data = new Map<string, string>()
    return { get: async (key: string) => data.get(key) ?? null, set: async (key: string, value: string) => { data.set(key, value) } }
  }

  it('starts with nothing agreed and not decided', async () => {
    expect(await loadConsent(memory())).toEqual(NO_CONSENT)
  })

  it('round-trips a choice and marks it decided', async () => {
    const store = memory()
    await saveConsent(store, { analytics: true, crashReports: false, decided: false })
    expect(await loadConsent(store)).toEqual({ analytics: true, crashReports: false, decided: true })
  })

  it('treats a corrupt value as no consent', async () => {
    const store = { get: async () => '{not json', set: async () => {} }
    expect(await loadConsent(store)).toEqual(NO_CONSENT)
  })
})

// Compile-time checks: these lines must NOT type-check. `pnpm ts` fails if the expectation is removed.
describe('typed events', () => {
  it('rejects unknown events and wrong properties at compile time', () => {
    const telemetry = createTelemetry<Events>()
    // @ts-expect-error not an event in the map
    telemetry.track('pack_opend', { rarity: 'star' })
    // @ts-expect-error wrong property name
    telemetry.track('pack_opened', { rarty: 'star' })
    // @ts-expect-error an event with properties needs them
    telemetry.track('pack_opened')
    expect(true).toBe(true)
  })
})
