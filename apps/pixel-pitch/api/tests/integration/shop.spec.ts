import type { GameResponse } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import type { Session } from './harness'
import { BASE_KITS, DEFAULT_CONFIG, seasonOf } from '@ld/pixel-pitch-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { act, DAY, found } from './game-helpers'
import { boot, call, guest } from './harness'

const SECRET = 'test-revenuecat-secret'
const config = DEFAULT_CONFIG
const T0 = Date.now()

let payload: Payload
let alice: Session
let bob: Session
let carol: Session

type State = GameResponse['club']['state']
const sync = async (session: Session, at = T0) => ((await act(session, 'sync', {}, { at })).json as GameResponse)
async function setState(session: Session, patch: (current: State) => object) {
  const current = (await sync(session)).club
  await payload.update({ collection: 'clubs', id: current.id, data: { state: { ...current.state, ...patch(current.state) } as never }, overrideAccess: true })
}
function paid(user: Session, id: string, productId: string, type = 'NON_RENEWING_PURCHASE') {
  return call('POST', '/api/purchases/revenuecat', {
    origin: null,
    headers: { authorization: `Bearer ${SECRET}` },
    body: { api_version: '1.0', event: { id, type, app_user_id: String(user.user!.id), product_id: productId, store: 'APP_STORE' } },
  })
}
const ledgerOf = (session: Session, reason: string) => payload.find({ collection: 'ledger', where: { and: [{ owner: { equals: session.user!.id } }, { reason: { equals: reason } }] }, overrideAccess: true })

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest('bearer')
  carol = await guest()
  await found(alice, T0)
  await found(bob, T0, 'Bob FC')
})

describe('store purchases', () => {
  it('pays a gem pack into the buyer\'s club once, however often RevenueCat sends the event', async () => {
    const before = (await sync(alice)).club.state.idle.gems
    expect((await paid(alice, 'shop-gems-1', 'pp_gems_500')).status).toBe(200)
    expect((await paid(alice, 'shop-gems-1', 'pp_gems_500')).status).toBe(200)
    expect((await sync(alice)).club.state.idle.gems).toBe(before + 500)
    expect((await ledgerOf(alice, 'purchase')).docs.map(entry => entry.amount)).toEqual([500])
  })

  it('never pays into another player\'s club', async () => {
    const bobBefore = (await sync(bob)).club.state.idle.gems
    await paid(alice, 'shop-gems-2', 'pp_gems_80')
    expect((await sync(bob)).club.state.idle.gems).toBe(bobBefore)
  })

  it('turns the League Pass on for the current season', async () => {
    await paid(bob, 'shop-pass-1', 'pp_league_pass')
    const state = (await sync(bob)).club.state
    expect(state.idle.hasPass).toBe(true)
    expect(state.idle.passSeason).toBe(seasonOf(T0, config))
    const nextSeason = (seasonOf(T0, config) + 1) * config.pass.seasonDays * DAY + 60_000
    expect((await sync(bob, nextSeason)).club.state.idle.hasPass).toBe(false)
  })

  it('records but does not pay an unknown product, a buyer with no club, or a renewal event', async () => {
    const before = (await sync(alice)).club.state
    expect((await paid(alice, 'shop-unknown', 'pp_nothing')).status).toBe(200)
    expect((await paid(carol, 'shop-no-club', 'pp_gems_500')).status).toBe(200)
    expect((await paid(alice, 'shop-cancel', 'pp_gems_500', 'CANCELLATION')).status).toBe(200)
    expect((await sync(alice)).club.state.idle.gems).toBe(before.idle.gems)
    const events = await payload.find({ collection: 'purchase-events', where: { eventId: { in: ['shop-unknown', 'shop-no-club', 'shop-cancel'] } }, overrideAccess: true })
    expect(events.totalDocs).toBe(3)
  })
})

describe('what gems buy', () => {
  it('changes the club\'s kit and crest for gems, stored on the club', async () => {
    await setState(alice, current => ({ idle: { ...current.idle, gems: 1000 } }))
    const response = await act(alice, 'identity', { kitId: BASE_KITS[3].id, crest: 7 }, { at: T0 })
    expect(response.status).toBe(200)
    expect(response.json.club).toMatchObject({ crest: 7, kitPrimary: BASE_KITS[3].primary, kitSecondary: BASE_KITS[3].secondary })
    expect(response.json.club.state.idle.gems).toBe(1000 - config.shop.gems.identityChange)
    const stored = await payload.findByID({ collection: 'clubs', id: response.json.club.id, overrideAccess: true })
    expect(stored).toMatchObject({ crest: 7, kitPrimary: BASE_KITS[3].primary })
  })

  it('sells a premium kit and puts it on, and refuses a kit that is a Pass reward', async () => {
    const bought = await act(alice, 'shop/kit', { kitId: 'royal' }, { at: T0 })
    expect(bought.status).toBe(200)
    expect(bought.json.club.kitPrimary).toBe('#5a2d91')
    expect(bought.json.club.state.kits).toEqual(['royal'])
    const refused = await act(alice, 'shop/kit', { kitId: 'season-gold' }, { at: T0 })
    expect(refused.status).toBe(400)
    expect(JSON.stringify(refused.json)).toContain('not-for-sale')
  })

  it('adds bench room and refills energy', async () => {
    const bench = await act(alice, 'shop/bench', {}, { at: T0 })
    expect(bench.status).toBe(200)
    expect(bench.json.bench).toBe(config.cards.benchSize + config.shop.benchSlotsEach)
    const full = await act(alice, 'shop/energy', {}, { at: T0 })
    expect(full.status).toBe(400)
  })

  it('lets a Star Signing be used on an offered player only', async () => {
    await setState(alice, () => ({ signings: { pending: 1, taken: 0 } }))
    const refused = await act(alice, 'signing', { playerId: 'not-a-player' }, { at: T0 })
    expect(refused.status).toBe(400)
  })

  it('refuses all of it without a club', async () => {
    expect((await act(carol, 'shop/energy', {}, { at: T0 })).status).toBe(404)
  })
})
