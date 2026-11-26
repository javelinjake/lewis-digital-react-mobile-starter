import type { Chance, FixtureResult, GameResponse } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import type { Session } from './harness'
import { DEFAULT_CONFIG, perfectTaps, playConfig } from '@ld/pixel-pitch-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { act, found, HOUR } from './game-helpers'
import { boot, guest } from './harness'

const config = DEFAULT_CONFIG
const T0 = Date.UTC(2026, 10, 12, 12)

let payload: Payload
let alice: Session
let bob: Session
let now = T0

async function sync(session: Session) {
  return (await act(session, 'sync', {}, { at: now })).json as GameResponse
}

/** A league match Alice has played, from the database. */
async function aliceFixture(clubId: number): Promise<FixtureResult & { id: number }> {
  const club = await payload.findByID({ collection: 'clubs', id: clubId, depth: 0, overrideAccess: true })
  const result = await payload.find({ collection: 'fixtures', where: { and: [{ owner: { equals: club.owner } }, { no: { greater_than_equal: 0 } }] }, sort: 'no', limit: 1, depth: 0, overrideAccess: true })
  return result.docs[0] as unknown as FixtureResult & { id: number }
}

/** Puts a Big Chance for `fixture` in the club's bank, as a catch-up would. */
async function bank(game: GameResponse, fixture: FixtureResult, kind: Chance['kind'] = 'penalty') {
  const chance: Chance = { fixtureNo: fixture.no, kind, minute: 30, tier: fixture.tier, live: false, expiresAt: null, goalsFor: fixture.goalsFor, goalsAgainst: fixture.goalsAgainst, result: fixture.result }
  await payload.update({ collection: 'clubs', id: game.club.id, data: { state: { ...game.club.state, chances: [chance] } as never }, overrideAccess: true })
  return chance
}

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest('bearer')
  await found(alice, T0)
  await found(bob, T0, 'Bob FC')
  // The quick opening plays five league matches in the first hour.
  now = T0 + HOUR
})

describe('big Chances', () => {
  it('a scored penalty rewrites the stored match, pays the difference and can be played once', async () => {
    const game = await sync(alice)
    const fixture = await aliceFixture(game.club.id)
    const chance = await bank(game, fixture)

    const started = await act(alice, 'chance/start', { fixtureNo: chance.fixtureNo }, { at: now })
    expect(started.status).toBe(200)
    const ticket = (started.json as GameResponse).club.state.ticket!
    expect(ticket).toMatchObject({ kind: 'chance', cabinet: 'pens', tier: 1 })
    expect((started.json as GameResponse).club.state.chances).toEqual([])
    // One try: it has left the bank.
    expect((await act(alice, 'chance/start', { fixtureNo: chance.fixtureNo }, { at: now })).status).toBe(400)

    const taps = perfectTaps('pens', ticket.seed, playConfig(config, ticket))
    const finished = await act(alice, 'chance/finish', { taps }, { at: now + 60_000 })
    expect(finished.status).toBe(200)
    const body = finished.json as GameResponse & { scored: boolean, before: string, after: string, coins: number }
    expect(body.scored).toBe(true)
    expect(body.changedFixtures?.[0]).toMatchObject({ no: fixture.no, goalsFor: fixture.goalsFor + 1 })

    const stored = await payload.findByID({ collection: 'fixtures', id: fixture.id, depth: 0, overrideAccess: true })
    expect(stored.goalsFor).toBe(fixture.goalsFor + 1)
    expect((stored.events as Array<{ chance?: string }>).some(event => event.chance === 'penalty')).toBe(true)
    if (fixture.result !== 'win') {
      expect(body.after).not.toBe(body.before)
      expect(body.coins).toBeGreaterThan(0)
    }
  })

  it('is refused for another club\'s match, and without a ticket', async () => {
    const game = await sync(alice)
    const fixture = await aliceFixture(game.club.id)
    await bank(game, fixture)
    // Bob has no chance banked for that number: his own state is all the server looks at.
    expect((await act(bob, 'chance/start', { fixtureNo: fixture.no }, { at: now })).status).toBe(400)
    expect((await act(bob, 'chance/finish', { taps: [100] }, { at: now })).status).toBe(400)
    // Alice still has hers.
    expect((await sync(alice)).club.state.chances.map(entry => entry.fixtureNo)).toEqual([fixture.no])
  })

  it('can be let go, and the match stands', async () => {
    const game = await sync(alice)
    const fixture = await aliceFixture(game.club.id)
    const before = await payload.findByID({ collection: 'fixtures', id: fixture.id, depth: 0, overrideAccess: true })
    await bank(game, before as unknown as FixtureResult)
    const skipped = await act(alice, 'chance/skip', { fixtureNo: fixture.no }, { at: now })
    expect(skipped.status).toBe(200)
    expect((skipped.json as GameResponse).club.state.chances).toEqual([])
    const after = await payload.findByID({ collection: 'fixtures', id: fixture.id, depth: 0, overrideAccess: true })
    expect(after.goalsFor).toBe(before.goalsFor)
  })

  it('asks for a match number', async () => {
    expect((await act(alice, 'chance/start', {}, { at: now })).status).toBe(400)
  })
})
