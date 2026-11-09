import type { GameResponse } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import type { Session } from './harness'
import { DEFAULT_CONFIG } from '@ld/pixel-pitch-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { act, DAY, found, HOUR } from './game-helpers'
import { boot, guest } from './harness'

const config = DEFAULT_CONFIG
const T0 = Date.UTC(2026, 10, 10, 12)

let payload: Payload
let alice: Session
let bob: Session
let club: GameResponse
/** Clock for Alice's calls: each test moves it on, as time would. */
let now = T0

const decide = (session: Session, decisions: string[], key?: string) => act(session, 'packs/decide', { decisions }, { at: now, key })

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest('bearer')
  club = await found(alice, T0)
  await found(bob, T0, 'Bob FC')
})

describe('the pack shelf', () => {
  it('fills one pack every 45 minutes and holds ten', async () => {
    now = T0 + 3 * HOUR
    const synced = (await act(alice, 'sync', {}, { at: now })).json as GameResponse
    expect(synced.club.state.idle.shelfPacks).toBe(Math.floor((3 * HOUR) / (45 * 60_000)))

    now = T0 + 3 * DAY
    const full = (await act(alice, 'sync', {}, { at: now })).json as GameResponse
    expect(full.club.state.idle.shelfPacks).toBe(config.shelf.capacity)
    club = full
  })
})

describe('opening a pack', () => {
  it('takes a pack off the shelf and holds three players from the catalogue', async () => {
    const response = await act(alice, 'packs/open', { source: 'shelf' }, { at: now })
    expect(response.status).toBe(200)
    const opened: GameResponse = response.json
    expect(opened.club.state.idle.shelfPacks).toBe(config.shelf.capacity - 1)
    expect(opened.club.state.pendingPack).toMatchObject({ no: 1, source: 'shelf' })
    const ids = opened.club.state.pendingPack!.playerIds
    expect(ids).toHaveLength(3)
    const found = await payload.find({ collection: 'players', where: { catalogueId: { in: ids } }, limit: 10, depth: 0, overrideAccess: true })
    expect(found.totalDocs).toBe(3)
    club = opened
  })

  it('keeps the pack pending across syncs and refuses a second open', async () => {
    const synced = (await act(alice, 'sync', {}, { at: now + 1000 })).json as GameResponse
    expect(synced.club.state.pendingPack).toEqual(club.club.state.pendingPack)
    const second = await act(alice, 'packs/open', { source: 'shelf' }, { at: now + 1000 })
    expect(second.status).toBe(400)
    expect(JSON.stringify(second.json)).toContain('pending-pack')
  })

  it('replays the same answer for a repeated key, so a retry never opens two', async () => {
    const decided = await decide(alice, ['sell', 'sell', 'sell'], 'settle-first')
    expect(decided.status).toBe(200)
    const first = await act(alice, 'packs/open', { source: 'shelf' }, { at: now, key: 'open-once' })
    const again = await act(alice, 'packs/open', { source: 'shelf' }, { at: now, key: 'open-once' })
    expect(again.headers.get('idempotent-replay')).toBe('true')
    expect(again.json).toEqual(first.json)
    expect(first.json.club.state.packsOpened).toBe(2)
    await decide(alice, ['sell', 'sell', 'sell'])
  })

  it('opens exactly one pack when two requests arrive together', async () => {
    const results = await Promise.all([1, 2, 3].map(() => act(alice, 'packs/open', { source: 'shelf' }, { at: now })))
    expect(results.filter(result => result.status === 200)).toHaveLength(1)
    expect(results.filter(result => result.status === 400)).toHaveLength(2)
    await decide(alice, ['sell', 'sell', 'sell'])
  })

  it('rolls the same players for the same pack number, whatever the time', async () => {
    const one = await act(alice, 'packs/open', { source: 'shelf' }, { at: now })
    const ids = one.json.club.state.pendingPack.playerIds
    const stored = await alice.get('/api/clubs?depth=0')
    expect(stored.json.docs[0].state.pendingPack.playerIds).toEqual(ids)
    await decide(alice, ['sell', 'sell', 'sell'])
  })
})

describe('signing and selling', () => {
  it('makes cards of the players signed and pays coins for the rest, with a ledger row for each sale', async () => {
    const opened = (await act(alice, 'packs/open', { source: 'shelf' }, { at: now })).json as GameResponse
    const [first, second, third] = opened.club.state.pendingPack!.playerIds
    const before = opened.club.state.coins
    const cardsBefore = opened.cards.length

    const response = await decide(alice, ['sign', 'sell', 'sign'])
    expect(response.status).toBe(200)
    const settled: GameResponse & { signed: number, sold: number, coins: number } = response.json
    expect(settled.club.state.pendingPack).toBeNull()
    expect(settled.signed).toBe(2)
    expect(settled.sold).toBe(1)
    expect(settled.cards).toHaveLength(cardsBefore + 2)
    const added = settled.cards.slice(-2)
    expect(added.map(card => card.playerId)).toEqual([first, third])
    expect(added.every(card => /^\d+$/.test(card.id) && card.stars === 1)).toBe(true)
    expect(settled.club.state.coins).toBe(before + settled.coins)

    const row = await payload.find({ collection: 'ledger', where: { and: [{ owner: { equals: alice.user!.id } }, { reason: { equals: 'sell' } }, { ref: { equals: second } }] }, depth: 0, overrideAccess: true })
    expect(row.docs.at(-1)?.amount).toBe(settled.coins)
    club = settled
  })

  it('keeps the album of everyone pulled, and refuses a bench over 20', async () => {
    expect(club.club.state.album.collected.length).toBeGreaterThan(3)
    // Fill the bench with planted cards, as a very long game would.
    const existing = await payload.count({ collection: 'cards', where: { owner: { equals: alice.user!.id } }, overrideAccess: true })
    for (let i = existing.totalDocs; i < config.cards.benchSize + 5; i++)
      await payload.create({ collection: 'cards', data: { owner: alice.user!.id, playerId: 'p001', stars: 1, trained: 0, source: 'pack' }, overrideAccess: true })
    const opened = await act(alice, 'packs/open', { source: 'shelf' }, { at: now })
    expect(opened.status).toBe(200)
    const full = await decide(alice, ['sign', 'sign', 'sign'])
    expect(full.status).toBe(400)
    expect(JSON.stringify(full.json)).toContain('bench-full')
    expect((await decide(alice, ['sell', 'sell', 'sell'])).status).toBe(200)
  })

  it('refuses a decision with nothing pending, and one with the wrong choices', async () => {
    expect((await decide(alice, ['sign', 'sign', 'sign'])).status).toBe(400)
    await act(alice, 'packs/open', { source: 'shelf' }, { at: now })
    expect((await decide(alice, ['sign'])).status).toBe(400)
    expect((await decide(alice, ['sign', 'keep', 'sell'])).status).toBe(400)
    expect((await act(alice, 'packs/decide', { decisions: 'sign' }, { at: now })).status).toBe(400)
    await decide(alice, ['sell', 'sell', 'sell'])
  })
})

describe('buying packs', () => {
  const setCoins = async (coins: number) => {
    const current = (await act(alice, 'sync', {}, { at: now })).json as GameResponse
    await payload.update({ collection: 'clubs', id: current.club.id, data: { state: { ...current.club.state, coins } as never }, overrideAccess: true })
  }

  it('costs 2,000 coins, opens at once, and stops at 3 a day', async () => {
    now += 2 * DAY
    await setCoins(20_000)
    let coins = 20_000
    for (let bought = 1; bought <= config.shelf.extraPacksPerDay; bought++) {
      const response = await act(alice, 'packs/buy', {}, { at: now })
      expect(response.status).toBe(200)
      coins -= config.shelf.extraPackCoins
      expect(response.json.club.state.coins).toBe(coins)
      expect(response.json.club.state.pendingPack.source).toBe('buy')
      // Selling all three brings some coins back; follow the balance the server reports.
      const settled = await decide(alice, ['sell', 'sell', 'sell'])
      coins = settled.json.club.state.coins
    }
    const fourth = await act(alice, 'packs/buy', {}, { at: now })
    expect(fourth.status).toBe(400)
    expect(JSON.stringify(fourth.json)).toContain('daily-limit')
  })

  it('starts again the next day', async () => {
    now += DAY
    expect((await act(alice, 'packs/buy', {}, { at: now })).status).toBe(200)
    await decide(alice, ['sell', 'sell', 'sell'])
  })

  it('refuses without the coins', async () => {
    now += DAY
    await setCoins(100)
    const response = await act(alice, 'packs/buy', {}, { at: now })
    expect(response.status).toBe(400)
    expect(JSON.stringify(response.json)).toContain('coins')
  })

  it('writes a ledger row for each purchase', async () => {
    const rows = await payload.find({ collection: 'ledger', where: { and: [{ owner: { equals: alice.user!.id } }, { reason: { equals: 'buy-pack' } }] }, limit: 20, depth: 0, overrideAccess: true })
    expect(rows.totalDocs).toBe(config.shelf.extraPacksPerDay + 1)
    expect(rows.docs.every(row => row.amount === -config.shelf.extraPackCoins && row.currency === 'coins')).toBe(true)
  })
})

describe('arcade packs', () => {
  it('cost 300 tokens and refuse without them', async () => {
    now += HOUR
    expect((await act(alice, 'packs/arcade', { position: 'GK' }, { at: now })).status).toBe(400)

    const current = (await act(alice, 'sync', {}, { at: now })).json as GameResponse
    await payload.update({ collection: 'clubs', id: current.club.id, data: { state: { ...current.club.state, tokens: 700 } as never }, overrideAccess: true })
    const bought = await act(alice, 'packs/arcade', { position: 'GK' }, { at: now })
    expect(bought.status).toBe(200)
    expect(bought.json.club.state.tokens).toBe(400)
    expect(bought.json.club.state.pendingPack.source).toBe('arcade')
    expect((await act(alice, 'packs/arcade', { position: 'WING' }, { at: now })).status).toBe(400)

    const settled = await decide(alice, ['sell', 'sell', 'sell'])
    expect(settled.status).toBe(200)
    const row = await payload.find({ collection: 'ledger', where: { and: [{ owner: { equals: alice.user!.id } }, { reason: { equals: 'arcade-pack' } }] }, depth: 0, overrideAccess: true })
    expect(row.docs.at(-1)).toMatchObject({ currency: 'tokens', amount: -300, ref: 'GK' })
  })
})

describe('privacy', () => {
  it('lets one player settle only their own pack', async () => {
    now += HOUR
    const opened = await act(bob, 'packs/open', { source: 'shelf' }, { at: now })
    expect(opened.status).toBe(200)
    const bobsPack = opened.json.club.state.pendingPack

    // Alice has nothing pending, and nothing she sends reaches Bob's pack.
    const attempt = await act(alice, 'packs/decide', { decisions: ['sell', 'sell', 'sell'] }, { at: now })
    expect(attempt.status).toBe(400)
    const bobAgain = (await act(bob, 'sync', {}, { at: now })).json as GameResponse
    expect(bobAgain.club.state.pendingPack).toEqual(bobsPack)

    const seen = await bob.get('/api/cards?depth=0&limit=100')
    expect(seen.json.docs.every((card: { owner: number }) => card.owner === bob.user!.id)).toBe(true)
    expect((await bob.patch(`/api/clubs/${bobAgain.club.id}`, { state: { ...bobAgain.club.state, pendingPack: null } })).status).toBe(403)
  })
})
