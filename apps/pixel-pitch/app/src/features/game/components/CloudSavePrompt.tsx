import type { GameResponse } from '@ld/pixel-pitch-core'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuthStore } from '@/stores/auth.store'
import { useGameConfig } from '../queries/use-game'

const KEY = 'pp-cloud-prompt'
const DAY = 24 * 60 * 60_000
/** Asked again this long after Not now. */
const AGAIN_MS = 2 * DAY

function dismissedAt(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0)
  }
  catch {
    return 0
  }
}

/**
 * For a player still on a guest club: once the club is a couple of days old, a nudge to save it to the cloud, so a
 * lost or replaced phone does not lose it. Not now hides it for two days. The shop asks the same before any purchase.
 */
export function CloudSavePrompt({ game }: { game: GameResponse }) {
  const config = useGameConfig()
  const guest = useAuthStore(state => state.user?.isAnonymous ?? false)
  const [hiddenAt, setHiddenAt] = useState(dismissedAt)
  // About two days of league matches since the club was founded.
  const oldEnough = game.club.state.league.fixtureNo >= Math.ceil((2 * 24) / config.league.matchIntervalHours)
  if (!guest || !oldEnough || Date.now() - hiddenAt < AGAIN_MS)
    return null

  const hide = () => {
    const now = Date.now()
    try {
      localStorage.setItem(KEY, String(now))
    }
    catch {
      // Not kept; it hides for this visit.
    }
    setHiddenAt(now)
  }
  return (
    <section className="flex flex-col gap-2 bg-raised p-3 shadow-[inset_0_0_0_3px_var(--color-accent)]" aria-label="Save your club">
      <span className="font-bold text-accent">Keep your club safe</span>
      <span>{`${game.club.name} lives only on this phone. Save it to the cloud and you will never lose it, and can play on any device.`}</span>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost min-h-11 flex-1" onClick={hide}>Not now</button>
        <Link to="/register?link=1" className="btn btn-accent min-h-11 flex-1">Save to the cloud</Link>
      </div>
    </section>
  )
}
