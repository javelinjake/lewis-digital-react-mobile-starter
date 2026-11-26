const KEY = 'pp-seen-cards'

function read(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null)
      return null
    const value: unknown = JSON.parse(raw)
    return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [])
  }
  catch {
    return null
  }
}

/**
 * The cards this device has already shown in the squad, so new signings can be marked NEW until the squad has been
 * looked at. The first time there is no list, so nothing is marked. Only a display hint: nothing here is game state.
 */
export function unseenCards(ids: readonly string[]): Set<string> {
  const seen = read()
  if (!seen)
    return new Set()
  return new Set(ids.filter(id => !seen.has(id)))
}

export function markCardsSeen(ids: readonly string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  }
  catch {
    // Private browsing: new players are not marked, which is harmless.
  }
}
