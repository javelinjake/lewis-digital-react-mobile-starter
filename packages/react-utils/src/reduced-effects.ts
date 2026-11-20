import { useEffect, useSyncExternalStore } from 'react'

/**
 * Low-effects mode: one switch for old phones and for people who ask for less motion.
 * It is not a second code path. The app root gets a `reduce-effects` class, CSS and a few canvas loops read it, and
 * every feature still works.
 *
 * On when: the person turned it on, OR they left it on "auto" and the device is weak (2 GB of memory or less, or four
 * cores or fewer, both reported by the Android WebView) or the operating system asks for reduced motion.
 */
export type EffectsSetting = 'auto' | 'on' | 'off'

export interface EffectsSignals {
  deviceMemory?: number
  hardwareConcurrency?: number
  prefersReducedMotion?: boolean
}

export const WEAK_DEVICE_MEMORY_GB = 2
export const WEAK_DEVICE_CORES = 4

export function shouldReduceEffects(setting: EffectsSetting, signals: EffectsSignals): boolean {
  if (setting === 'on')
    return true
  if (setting === 'off')
    return false
  return Boolean(signals.prefersReducedMotion)
    || (signals.deviceMemory !== undefined && signals.deviceMemory <= WEAK_DEVICE_MEMORY_GB)
    || (signals.hardwareConcurrency !== undefined && signals.hardwareConcurrency <= WEAK_DEVICE_CORES)
}

function readSignals(): EffectsSignals {
  if (typeof window === 'undefined')
    return {}
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
}

function subscribeToMotionPreference(listener: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

export function useReducedEffects(setting: EffectsSetting = 'auto'): boolean {
  const reduced = useSyncExternalStore(
    subscribeToMotionPreference,
    () => shouldReduceEffects(setting, readSignals()),
    () => false,
  )

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-effects', reduced)
    return () => document.documentElement.classList.remove('reduce-effects')
  }, [reduced])

  return reduced
}
