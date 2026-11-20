import type { Payload } from 'payload'
import type { Session } from './harness'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot, call, guest } from './harness'

const SECRET = 'test-revenuecat-secret'

let payload: Payload
let alice: Session
let bob: Session

function webhook(event: Record<string, unknown>, authorization: string | null = `Bearer ${SECRET}`) {
  return call('POST', '/api/purchases/revenuecat', {
    origin: null,
    headers: authorization ? { authorization } : {},
    body: { api_version: '1.0', event },
  })
}

function purchase(user: Session, id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'INITIAL_PURCHASE',
    app_user_id: String(user.user!.id),
    product_id: 'club_pass_monthly',
    entitlement_ids: ['club_pass'],
    expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
    store: 'APP_STORE',
    ...overrides,
  }
}

function entitlementsOf(user: Session) {
  return payload.find({ collection: 'entitlements', where: { owner: { equals: user.user!.id } }, overrideAccess: true })
}

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest()
})

describe('revenueCat webhook', () => {
  it('refuses a request without the secret', async () => {
    expect((await webhook(purchase(alice, 'evt-no-auth'), null)).status).toBe(401)
    expect((await webhook(purchase(alice, 'evt-bad-auth'), 'Bearer wrong')).status).toBe(401)
    expect((await entitlementsOf(alice)).totalDocs).toBe(0)
  })

  it('refuses a malformed event', async () => {
    expect((await call('POST', '/api/purchases/revenuecat', { origin: null, headers: { authorization: `Bearer ${SECRET}` }, body: { nope: true } })).status).toBe(400)
  })

  it('grants the entitlement for a purchase', async () => {
    const response = await webhook(purchase(alice, 'evt-1'))
    expect(response.status).toBe(200)

    const { docs } = await entitlementsOf(alice)
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ entitlement: 'club_pass', active: true, productId: 'club_pass_monthly', store: 'APP_STORE' })
  })

  it('applies a replayed event exactly once', async () => {
    const event = purchase(bob, 'evt-replay')
    expect((await webhook(event)).json).toMatchObject({ ok: true })
    expect((await webhook(event)).json).toMatchObject({ ok: true, duplicate: true })
    expect((await webhook(event)).json).toMatchObject({ duplicate: true })

    expect((await entitlementsOf(bob)).totalDocs).toBe(1)
    const events = await payload.count({ collection: 'purchase-events', where: { eventId: { equals: 'evt-replay' } }, overrideAccess: true })
    expect(events.totalDocs).toBe(1)
  })

  it('renews and then revokes the same entitlement without duplicating it', async () => {
    const user = await guest()
    await webhook(purchase(user, 'evt-buy'))
    await webhook(purchase(user, 'evt-renew', { type: 'RENEWAL' }))
    expect((await entitlementsOf(user)).docs).toHaveLength(1)

    await webhook(purchase(user, 'evt-expire', { type: 'EXPIRATION', expiration_at_ms: Date.now() - 1000 }))
    const { docs } = await entitlementsOf(user)
    expect(docs).toHaveLength(1)
    expect(docs[0].active).toBe(false)
  })

  it('acknowledges events for unknown or anonymous RevenueCat users without creating anything', async () => {
    expect((await webhook({ id: 'evt-ghost', type: 'INITIAL_PURCHASE', app_user_id: '999999', entitlement_ids: ['club_pass'] })).status).toBe(200)
    expect((await webhook({ id: 'evt-anon', type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:abc', entitlement_ids: ['club_pass'] })).status).toBe(200)
    expect(await payload.count({ collection: 'entitlements', where: { owner: { equals: 999_999 } }, overrideAccess: true })).toMatchObject({ totalDocs: 0 })
  })

  it('rolls back the whole event if the entitlement write fails, so a retry applies it', async () => {
    const user = await guest()
    const failing = purchase(user, 'evt-atomic', { entitlement_ids: ['x'.repeat(500)] })
    const first = await webhook(failing)
    expect(first.status).toBeGreaterThanOrEqual(400)

    const recorded = await payload.count({ collection: 'purchase-events', where: { eventId: { equals: 'evt-atomic' } }, overrideAccess: true })
    expect(recorded.totalDocs).toBe(0)
  })
})

describe('entitlement visibility', () => {
  it('lets a user read their own entitlements and nobody else\'s', async () => {
    const mine = await alice.get('/api/entitlements?depth=0')
    expect(mine.json.docs.length).toBeGreaterThan(0)
    expect(mine.json.docs.every((doc: { owner: number }) => doc.owner === alice.user!.id)).toBe(true)

    const theirs = await bob.get('/api/entitlements?depth=0')
    expect(theirs.json.docs.every((doc: { owner: number }) => doc.owner === bob.user!.id)).toBe(true)
  })

  it('never lets a client grant or change an entitlement', async () => {
    const created = await alice.post('/api/entitlements', { owner: alice.user!.id, entitlement: 'club_pass', active: true })
    expect(created.status).toBeGreaterThanOrEqual(400)

    const own = (await entitlementsOf(alice)).docs[0]
    const updated = await alice.patch(`/api/entitlements/${own.id}`, { active: false })
    expect(updated.status).toBeGreaterThanOrEqual(400)
    const deleted = await alice.delete(`/api/entitlements/${own.id}`)
    expect(deleted.status).toBeGreaterThanOrEqual(400)
  })

  it('keeps the purchase event log away from clients', async () => {
    const response = await alice.get('/api/purchase-events')
    expect(response.json?.docs ?? []).toHaveLength(0)
  })
})
