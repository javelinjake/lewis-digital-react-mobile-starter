import type { GameResponse } from '@ld/pixel-pitch-core'
import type { Session } from './harness'
import { randomUUID } from 'node:crypto'
import type { Ticket } from '@ld/pixel-pitch-core'
import { DEFAULT_CONFIG, perfectTaps, playConfig, runKeepy } from '@ld/pixel-pitch-core'

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

/** The tuning a ticket's play runs at: the games are quicker in each league. */
export const tuned = (ticket: Pick<Ticket, 'kind' | 'tier'>) => playConfig(config, ticket)

/** The millisecond in each Kick Timer round at which the marker is nearest the target. */
export const perfectKickTaps = (ticket: Ticket) => perfectTaps('kick', ticket.seed, tuned(ticket))

/** The millisecond in each penalty at which a shot goes in the corner, so a perfect shootout can be played. */
export const perfectPenaltyTaps = (ticket: Ticket) => perfectTaps('pens', ticket.seed, tuned(ticket))

/** Taps on the ball a step after it comes within reach (each with where it landed), and how many steps the play lasts. */
export function perfectKeepyTaps(ticket: Ticket) {
  const taps = perfectTaps('keepy', ticket.seed, tuned(ticket))
  return { taps, steps: runKeepy(ticket.seed, taps, tuned(ticket)).steps }
}
