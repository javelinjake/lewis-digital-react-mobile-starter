import { useCallback, useSyncExternalStore } from 'react'

export const NOTIFICATION_TYPES = [
  { type: 'shelf-full', label: 'Pack shelf full' },
  { type: 'full-time', label: 'Match played' },
  { type: 'trays-full', label: 'Arcade trays full' },
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['type']

const KEY = 'pp-notifications'
const ALL: readonly NotificationType[] = NOTIFICATION_TYPES.map(entry => entry.type)
const listeners = new Set<() => void>()
let cache: { raw: string | null, value: readonly NotificationType[] } | undefined

function read(): readonly NotificationType[] {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  }
  catch {
    // Storage is unavailable: every alert stays on.
  }
  if (cache?.raw === raw)
    return cache.value
  let value: readonly NotificationType[] = ALL
  if (raw) {
    try {
      const saved = JSON.parse(raw) as unknown
      if (Array.isArray(saved))
        value = ALL.filter(type => saved.includes(type))
    }
    catch {
      // A broken saved value falls back to everything on.
    }
  }
  cache = { raw, value }
  return value
}

/** Which alerts the player wants (all on until they say otherwise). Kept on this device. */
export function useNotificationSettings(): [readonly NotificationType[], (type: NotificationType, on: boolean) => void] {
  const enabled = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => ALL,
  )
  const set = useCallback((type: NotificationType, on: boolean) => {
    const next = ALL.filter(entry => (entry === type ? on : read().includes(entry)))
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    }
    catch {
      // Not saved; the switch still works until the page closes.
    }
    cache = { raw: JSON.stringify(next), value: next }
    for (const listener of listeners)
      listener()
  }, [])
  return [enabled, set]
}
