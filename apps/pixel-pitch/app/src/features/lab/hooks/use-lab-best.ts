import type { LabGameId } from '../lib/games'
import { useCallback, useState } from 'react'

const KEY = 'pp-lab-best'

type Bests = Partial<Record<LabGameId, number>>

function read(): Bests {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Bests
  }
  catch {
    return {}
  }
}

/** The best score in each test game, kept on this device only (they are prototypes: nothing is sent anywhere). */
export function useLabBest() {
  const [bests, setBests] = useState(read)
  const record = useCallback((id: LabGameId, score: number) => {
    const current = read()
    if (score <= (current[id] ?? 0))
      return false
    const next = { ...current, [id]: score }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    }
    catch {
      // Storage is unavailable: the best lasts for this visit only.
    }
    setBests(next)
    return true
  }, [])
  return { bests, record }
}
