import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(listener: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/**
 * True when the person's operating system asks for reduced motion. Only that: a weak phone is not a reason to take
 * the pacing away from a written report, which costs nothing to run.
 */
export function useOsReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}
