import type { GameResponse } from '@ld/pixel-pitch-core'
import type { Session } from './harness'
import { randomUUID } from 'node:crypto'

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
