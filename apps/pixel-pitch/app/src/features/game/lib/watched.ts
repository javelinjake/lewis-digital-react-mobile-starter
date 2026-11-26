import type { FixtureResult } from '@ld/pixel-pitch-core'

const KEY = 'pp-watched'
/** Enough for weeks of matches; the oldest fall off. */
const LIMIT = 200

const keyOf = (fixture: FixtureResult) => `${fixture.no}:${fixture.kickoffAt}`

function read(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
  }
  catch {
    return []
  }
}

/**
 * Whether this device has already shown a match to the end. A match seen once opens on its result and report, so
 * tapping an old result does not play the whole match again. Only a display choice: nothing here is game state.
 */
export function wasWatched(fixture: FixtureResult) {
  return read().includes(keyOf(fixture))
}

export function markWatched(fixture: FixtureResult) {
  const key = keyOf(fixture)
  const list = read()
  if (list.includes(key))
    return
  try {
    localStorage.setItem(KEY, JSON.stringify([...list, key].slice(-LIMIT)))
  }
  catch {
    // Private browsing: it plays again next time, which is harmless.
  }
}
