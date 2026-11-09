import type { OwnedCard } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import type { GameResponse } from '../../cms/game/mutate-club'
import type { Session } from './harness'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { ApiError, createApiClient } from '@ld/api-client'
import { DEFAULT_CONFIG, generateCatalogue, sellValue, syncClub } from '@ld/pixel-pitch-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearGameCache } from '../../cms/game/load'
import { boot, call, guest, inProcessFetch } from './harness'

const HOUR = 60 * 60 * 1000
const config = DEFAULT_CONFIG
const catalogue = generateCatalogue(config)
const players = (id: string) => catalogue.find(player => player.id === id)

let payload: Payload
let alice: Session
let bob: Session
let aliceClub: GameResponse
let T0: number

function act(session: Session, path: string, body: unknown = {}, options: { key?: string, at?: number } = {}) {
  return session.post(`/api/game/${path}`, body, {
    headers: {
      'idempotency-key': options.key ?? randomUUID(),
      ...(options.at === undefined ? {} : { 'x-debug-now': String(options.at) }),
    },
  })
}

const newClub = { name: 'Harbour Town', crest: 3, kitPrimary: '#d03a2f', kitSecondary: '#f4f1e8' }

beforeAll(async () => {
  payload = await boot()
  clearGameCache()
  alice = await guest()
  bob = await guest('bearer')
  T0 = Date.UTC(2026, 10, 9, 12)
  const created = await act(alice, 'club', newClub, { at: T0 })
  expect(created.status).toBe(201)
  aliceClub = created.json
})

describe('creating a club', () => {
  it('signs a starter squad of five with one Pro, fields them and wins the debut', () => {
    expect(aliceClub.club).toMatchObject({ name: 'Harbour Town', crest: 3, version: 1 })
    expect(aliceClub.cards).toHaveLength(5)
    expect(aliceClub.cards.filter(card => players(card.playerId)?.rarity === 'pro')).toHaveLength(1)
    expect(aliceClub.club.state.lineup.filter(Boolean).sort()).toEqual(aliceClub.cards.map(card => card.id).sort())
    expect(aliceClub.fixtures).toHaveLength(1)
    expect(aliceClub.fixtures[0]).toMatchObject({ no: -1, result: 'win', coins: config.league.winCoins })
    expect(aliceClub.club.state.coins).toBe(config.league.winCoins)
    expect(aliceClub.club.state.idle.gems).toBe(config.daily.gems)
    expect(aliceClub.club.state.league.nextKickoffAt).toBe(T0 + 3 * HOUR)
  })

  it('only once per player', async () => {
    const again = await act(alice, 'club', newClub, { at: T0 })
    expect(again.status).toBe(409)
  })

  it('checks the name, crest and kit', async () => {
    const carol = await guest()
    expect((await act(carol, 'club', { ...newClub, name: 'x' })).status).toBe(400)
    expect((await act(carol, 'club', { ...newClub, crest: 99 })).status).toBe(400)
    expect((await act(carol, 'club', { ...newClub, kitPrimary: 'red' })).status).toBe(400)
  })

  it('answers 404 to any other action until the club exists', async () => {
    const response = await act(bob, 'sync')
    expect(response.status).toBe(404)
    expect(JSON.stringify(response.json)).toContain('no-club')
  })
})

describe('privacy and who writes', () => {
  it('lets a player read only their own club, cards, fixtures and ledger', async () => {
    await act(bob, 'club', { ...newClub, name: 'Bob FC' }, { at: T0 })
    for (const slug of ['clubs', 'cards', 'fixtures', 'ledger']) {
      const mine = await bob.get(`/api/${slug}?limit=100&depth=0`)
      expect(mine.status).toBe(200)
      expect(mine.json.docs.every((doc: { owner: number }) => doc.owner === bob.user!.id)).toBe(true)
      expect(mine.json.docs.length).toBeGreaterThan(0)
    }
  })

  it('never lets a client write game data directly, even its own', async () => {
    const club = aliceClub.club
    expect((await alice.patch(`/api/clubs/${club.id}`, { state: { ...club.state, coins: 1_000_000 } })).status).toBe(403)
    expect((await alice.post('/api/cards', { owner: alice.user!.id, playerId: 'p001', stars: 5, trained: 0, source: 'pack' })).status).toBe(403)
    expect((await alice.delete(`/api/cards/${aliceClub.cards[0].id}`)).status).toBe(403)
    expect((await alice.post('/api/ledger', { owner: alice.user!.id, currency: 'coins', amount: 5, balance: 5, reason: 'gift' })).status).toBe(403)
  })

  it('refuses a lineup with someone else\'s card', async () => {
    const response = await act(bob, 'lineup', { formation: '2-2', lineup: [aliceClub.cards[0].id, null, null, null, null] }, { at: T0 })
    expect(response.status).toBe(400)
    expect(JSON.stringify(response.json)).toContain('not-owned')
  })
})

describe('syncing', () => {
  it('plays the matches that fell due, exactly as the rules say, and records them', async () => {
    const at = T0 + 10 * HOUR
    const response = await act(alice, 'sync', {}, { at })
    expect(response.status).toBe(200)
    const synced: GameResponse = response.json

    const expected = syncClub({ state: aliceClub.club.state, cards: aliceClub.cards, players, clubId: aliceClub.club.id, config, now: at })
    expect(synced.fixtures).toEqual(expected.fixtures)
    expect(synced.club.state).toEqual(expected.state)
    expect(synced.fixtures).toHaveLength(3)
    expect(synced.events.find(event => event.type === 'matches')).toMatchObject({ played: 3 })

    const stored = await alice.get('/api/fixtures?limit=100&sort=no')
    expect(stored.json.docs.map((fixture: { no: number }) => fixture.no)).toEqual([-1, 0, 1, 2])
    // Each match keeps both squads' names, so its written report reads the same whenever it is opened.
    for (const [index, fixture] of stored.json.docs.entries()) {
      expect(fixture.squads.ours).toHaveLength(5)
      expect(fixture.squads.theirs).toHaveLength(5)
      expect(fixture.formation).toBe(index === 0 ? aliceClub.fixtures[0].formation : expected.fixtures[index - 1].formation)
    }
    aliceClub = synced
  })

  it('replays the first answer for a repeated key instead of syncing twice', async () => {
    const at = T0 + 13 * HOUR
    const first = await act(alice, 'sync', {}, { key: 'sync-once', at })
    const second = await act(alice, 'sync', {}, { key: 'sync-once', at: at + 24 * HOUR })
    expect(second.headers.get('idempotent-replay')).toBe('true')
    expect(second.json).toEqual(first.json)
    aliceClub = first.json
  })

  it('keeps the ledger in step with the coins', async () => {
    const ledger = await alice.get('/api/ledger?limit=1000')
    const coins = ledger.json.docs.filter((row: { currency: string }) => row.currency === 'coins').reduce((sum: number, row: { amount: number }) => sum + row.amount, 0)
    expect(coins).toBe(aliceClub.club.state.coins)
  })

  it('plays at most the catch-up limit after a long absence', async () => {
    const response = await act(alice, 'sync', {}, { at: T0 + 20 * 24 * HOUR })
    expect(response.json.fixtures).toHaveLength(config.league.maxCatchUpMatches)
    expect(response.json.events.find((event: { type: string }) => event.type === 'matches').skipped).toBeGreaterThan(0)
    aliceClub = response.json
  })

  it('ignores X-Debug-Now when time travel is off', async () => {
    const before = process.env.ALLOW_TIME_TRAVEL
    process.env.ALLOW_TIME_TRAVEL = '0'
    try {
      const response = await act(alice, 'sync', {}, { at: T0 + 400 * 24 * HOUR })
      expect(response.status).toBe(200)
      expect(response.json.fixtures).toHaveLength(0)
      expect(Math.abs(response.json.now - Date.now())).toBeLessThan(60_000)
    }
    finally {
      process.env.ALLOW_TIME_TRAVEL = before
    }
  })
})

describe('changing the squad', () => {
  const at = () => aliceClub.club.state.league.nextKickoffAt - HOUR

  it('saves a lineup and refuses a duplicate', async () => {
    const ids = aliceClub.club.state.lineup
    const saved = await act(alice, 'lineup', { formation: '1-1-2', lineup: [ids[0], ids[1], null, ids[3], ids[4]] }, { at: at() })
    expect(saved.status).toBe(200)
    expect(saved.json.club.state).toMatchObject({ formation: '1-1-2', lineup: [ids[0], ids[1], null, ids[3], ids[4]] })
    aliceClub = saved.json

    const duplicate = await act(alice, 'lineup', { formation: '2-2', lineup: [ids[0], ids[0], null, null, null] }, { at: at() })
    expect(duplicate.status).toBe(400)
  })

  it('sells a bench player for coins', async () => {
    const bench = aliceClub.cards.find(card => !aliceClub.club.state.lineup.includes(card.id))!
    const coins = aliceClub.club.state.coins
    const sold = await act(alice, 'sell', { cardId: bench.id }, { at: at() })
    expect(sold.status).toBe(200)
    expect(sold.json.club.state.coins).toBe(coins + sellValue(bench, players(bench.playerId)!, config))
    expect(sold.json.cards.map((card: OwnedCard) => card.id)).not.toContain(bench.id)
    aliceClub = sold.json
  })

  it('trains a card with coins', async () => {
    const card = aliceClub.cards[0]
    const trained = await act(alice, 'train', { cardId: card.id }, { at: at() })
    expect(trained.status).toBe(200)
    expect(trained.json.cards.find((entry: OwnedCard) => entry.id === card.id).trained).toBe(1)
    expect(trained.json.club.state.coins).toBeLessThan(aliceClub.club.state.coins)
    aliceClub = trained.json
  })

  it('merges three copies into one card a star higher', async () => {
    // Copies come from packs in M3; plant them the way a pack would.
    const playerId = aliceClub.cards[0].playerId
    for (let copy = 0; copy < 3; copy++)
      await payload.create({ collection: 'cards', data: { owner: alice.user!.id, playerId, stars: 1, trained: 0, source: 'pack' }, overrideAccess: true })
    const synced = (await act(alice, 'sync', {}, { at: at() })).json as GameResponse
    const copies = synced.cards.filter(card => card.playerId === playerId && card.stars === 1 && !synced.club.state.lineup.includes(card.id)).slice(0, 3)

    const merged = await act(alice, 'merge', { cardIds: copies.map(card => card.id) }, { at: at() })
    expect(merged.status).toBe(200)
    const after: OwnedCard[] = merged.json.cards
    expect(after.filter(card => copies.some(copy => copy.id === card.id))).toEqual([])
    expect(after.find(card => card.playerId === playerId && card.stars === 2)).toBeDefined()
    expect(after.every(card => /^\d+$/.test(card.id))).toBe(true)
    aliceClub = merged.json
  })

  it('applies simultaneous changes one after the other, never losing one', async () => {
    const before = (await alice.get(`/api/clubs/${aliceClub.club.id}`)).json.version as number
    const ids = aliceClub.club.state.lineup
    const results = await Promise.all(['2-2', '3-1', '1-2-1', '2-1-1'].map(formation => act(alice, 'lineup', { formation, lineup: ids }, { at: at() })))
    expect(results.map(result => result.status)).toEqual([200, 200, 200, 200])
    // Each answer saw the one before it: four distinct versions, and the club ends four versions on.
    expect(new Set(results.map(result => result.json.club.version)).size).toBe(4)
    const after = (await alice.get(`/api/clubs/${aliceClub.club.id}`)).json
    expect(after.version).toBe(before + 4)
    const last = results.find(result => result.json.club.version === before + 4)!
    expect(after.state.formation).toBe(last.json.club.state.formation)
  })
})

describe('game config', () => {
  it('is public to read and refuses an invalid save', async () => {
    expect((await call('GET', '/api/globals/game-config')).status).toBe(200)
    await expect(payload.updateGlobal({ slug: 'game-config', data: { config: { ...config, version: 1, packs: { ...config.packs, oddsByLeague: [[50, 50, 50, 0, 0]] } } }, overrideAccess: true })).rejects.toThrow(/not valid/)
  })

  it('bumps the version on every save, and results carry it', async () => {
    const saved = await payload.updateGlobal({ slug: 'game-config', data: { config: { ...config } }, overrideAccess: true })
    expect((saved.config as unknown as { version: number }).version).toBe(config.version + 1)
    clearGameCache()
    const response = await act(alice, 'sync', {}, { at: aliceClub.club.state.league.nextKickoffAt })
    expect(response.json.configVersion).toBe(config.version + 1)
    const latest = await alice.get('/api/fixtures?limit=1&sort=-no')
    expect(latest.json.docs[0].configVersion).toBe(config.version + 1)
  })
})

describe('the app\'s api client', () => {
  it('creates a club and syncs through the real client, and gets a readable refusal', async () => {
    const client = createApiClient({ baseUrl: '', mode: 'cookie', fetch: inProcessFetch() })
    await client.auth.signInAnonymously()
    const created = await client.action<GameResponse>('/game/club', { ...newClub, name: 'Client FC' })
    expect(created.cards).toHaveLength(5)
    const synced = await client.action<GameResponse>('/game/sync')
    expect(synced.club.id).toBe(created.club.id)
    const refused = await client.action('/game/club', { ...newClub, name: 'Again' }).catch((error: unknown) => error)
    expect(refused).toBeInstanceOf(ApiError)
    expect((refused as ApiError).status).toBe(409)
    expect((refused as ApiError).message).toContain('already have a club')
  })
})
