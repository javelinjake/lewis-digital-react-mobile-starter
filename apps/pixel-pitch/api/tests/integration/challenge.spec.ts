import type { ChallengeBoard, GameResponse } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import type { Session } from './harness'
import { challengeCabinet, dayIndex, DEFAULT_CONFIG, perfectTaps, playConfig, weekOf } from '@ld/pixel-pitch-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { act, DAY, found } from './game-helpers'
import { boot, guest } from './harness'

const config = DEFAULT_CONFIG
// A Keeper Reflex day, so a short play that ends in a goal is easy to write.
const BASE = Date.UTC(2026, 10, 16, 12)
const T0 = [0, 1, 2, 3, 4].map(day => BASE + day * DAY).find(time => challengeCabinet(time, config) === 'keeper')!

let payload: Payload
let alice: Session
let bob: Session
let carol: Session

/** Plays the day's challenge: `saves` saves, then a goal goes in. */
async function play(session: Session, saves: number, at = T0) {
  const started = await act(session, 'challenge/start', {}, { at })
  expect(started.status).toBe(200)
  const ticket = (started.json as GameResponse).club.state.ticket!
  const taps = [...(perfectTaps('keeper', ticket.seed, playConfig(config, ticket)) as unknown[]).slice(0, saves), null]
  return act(session, 'challenge/finish', { taps }, { at: at + 5 * 60_000 })
}

const board = async (session: Session, at = T0) => (await act(session, 'challenge/board', {}, { at: at + 6 * 60_000 })).json as ChallengeBoard

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest('bearer')
  carol = await guest()
  await found(alice, T0 - DAY)
  await found(bob, T0 - DAY, 'Bob FC')
  await found(carol, T0 - DAY, 'Carol Utd')
})

describe('the daily challenge', () => {
  it('is replayed by the server, paid, and put on the board once', async () => {
    const finished = await play(alice, 6)
    expect(finished.status).toBe(200)
    expect(finished.json).toMatchObject({ cabinet: 'keeper', score: 6, tokens: config.challenge.tokens, medals: ['bronze'], flagged: null })
    const rows = await payload.find({ collection: 'challenge-entries', where: { owner: { equals: alice.user!.id } }, depth: 0, overrideAccess: true })
    expect(rows.docs).toHaveLength(1)
    expect(rows.docs[0]).toMatchObject({ score: 6, clubName: 'Harbour Town', week: weekOf(rows.docs[0].day) })
    // One attempt a day.
    expect((await act(alice, 'challenge/start', {}, { at: T0 + 10 * 60_000 })).status).toBe(400)
  })

  it('ranks the day\'s players and shows each only the public parts of the others', async () => {
    expect((await play(bob, 9)).status).toBe(200)
    const seen = await board(alice)
    expect(seen.daily.map(row => [row.rank, row.clubName, row.score, row.you])).toEqual([[1, 'Bob FC', 9, false], [2, 'Harbour Town', 6, true]])
    expect(seen.you).toEqual({ rank: 2, score: 6, held: false })
    expect(Object.keys(seen.daily[0]).sort()).toEqual(['clubName', 'crest', 'kitPrimary', 'kitSecondary', 'rank', 'score', 'you'])
    expect(seen.weekly[0]).toMatchObject({ rank: 1, clubName: 'Bob FC', score: 100, days: 1 })
  })

  it('keeps a held score off everyone else\'s board until an admin passes it', async () => {
    expect((await play(carol, 3)).status).toBe(200)
    const row = (await payload.find({ collection: 'challenge-entries', where: { owner: { equals: carol.user!.id } }, depth: 0, overrideAccess: true })).docs[0]
    await payload.update({ collection: 'challenge-entries', id: row.id, data: { score: 999, flagged: 'above-ceiling' }, overrideAccess: true })
    expect((await board(alice)).daily.some(entry => entry.clubName === 'Carol Utd')).toBe(false)
    expect((await board(carol)).you).toMatchObject({ score: 999, held: true })
    await payload.update({ collection: 'challenge-entries', id: row.id, data: { reviewed: true }, overrideAccess: true })
    expect((await board(alice)).daily[0]).toMatchObject({ clubName: 'Carol Utd', score: 999 })
  })

  it('cannot be written or edited by a player', async () => {
    const created = await bob.post('/api/challenge-entries', { day: 1, week: 0, cabinet: 'kick', score: 10_000, clubName: 'x', crest: 0, kitPrimary: '#000000', kitSecondary: '#000000' })
    expect(created.status).toBeGreaterThanOrEqual(400)
  })

  it('pays last week\'s band once the week is over, once', async () => {
    // Midday on the first day of the next week.
    const later = (weekOf(dayIndex(T0, config)) + 1) * 7 * DAY + DAY / 2
    const claimed = await act(carol, 'challenge/weekly', {}, { at: later })
    expect(claimed.status).toBe(200)
    expect(claimed.json).toMatchObject({ band: 'top3', badge: 'challenge-podium' })
    expect((claimed.json as GameResponse).club.state.badges).toEqual(['challenge-podium'])
    expect((await act(carol, 'challenge/weekly', {}, { at: later })).status).toBe(400)
  })
})
