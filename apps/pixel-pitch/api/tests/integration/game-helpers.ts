import type { GameResponse } from '@ld/pixel-pitch-core'
import type { Session } from './harness'
import { randomUUID } from 'node:crypto'
import { DEFAULT_CONFIG, kickRounds, markerAt, newKeepy, stepKeepy, warmupBar } from '@ld/pixel-pitch-core'

export const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR
export const newClub = { name: 'Harbour Town', crest: 3, kitPrimary: '#d03a2f', kitSecondary: '#f4f1e8' }

/** Calls a game action as `session`. `at` is the server's clock for the call (time travel is on in the tests). */
export function act(session: Session, path: string, body: unknown = {}, options: { key?: string, at?: number } = {}) {
  return session.post(`/api/game/${path}`, body, {
    headers: {
      'idempotency-key': options.key ?? randomUUID(),
      ...(options.at === undefined ? {} : { 'x-debug-now': String(options.at) }),
    },
  })
}

/** Founds a club for a signed-in session at `at`, and returns what the server answered. */
export async function found(session: Session, at: number, name = newClub.name): Promise<GameResponse> {
  const response = await act(session, 'club', { ...newClub, name }, { at })
  if (response.status !== 201)
    throw new Error(`Could not found a club: ${response.status} ${JSON.stringify(response.json)}`)
  return response.json
}

// ---- A player who plays the arcade perfectly, so a test can finish a play the way a real one would. ----

const config = DEFAULT_CONFIG

/** The millisecond in each Kick Timer round at which the marker is nearest the target. */
export function perfectKickTaps(seed: string) {
  return kickRounds(seed, config).map((bar) => {
    let best = 150
    for (let ms = 150; ms < 4000; ms++) {
      if (Math.abs(markerAt(bar, ms) - bar.centre) < Math.abs(markerAt(bar, best) - bar.centre))
        best = ms
    }
    return best
  })
}

/** The steps at which a player with a steady reaction would tap, and how many steps the play lasts. */
export function perfectKeepyTaps(seed: string) {
  let sim = newKeepy(seed)
  const taps: number[] = []
  let was = false
  let wait = -1
  while (!sim.over && sim.step < 7200) {
    const inReach = sim.vy < 0 && sim.y <= config.minigames.keepy.reach
    if (inReach && !was)
      wait = 6
    was = inReach
    let tap = false
    if (wait === 0) {
      tap = true
      wait = -1
    }
    else if (wait > 0) {
      wait--
    }
    if (tap)
      taps.push(sim.step)
    sim = stepKeepy(sim, tap, config)
  }
  return { taps, steps: sim.step }
}

export function bestWarmupTap(seed: string) {
  const bar = warmupBar(seed, config)
  let best = 150
  for (let ms = 150; ms < 4000; ms++) {
    if (Math.abs(markerAt(bar, ms) - bar.centre) < Math.abs(markerAt(bar, best) - bar.centre))
      best = ms
  }
  return best
}
