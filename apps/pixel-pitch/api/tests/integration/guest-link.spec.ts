import type { GameResponse } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'
import { act, found } from './game-helpers'
import { boot, guest, Session } from './harness'

const T0 = Date.UTC(2026, 10, 9, 12)
const PASSWORD = 'a-long-test-password'

let payload: Payload

/** An email account, confirmed, the way a player who registered on another device would have one. */
async function register(session: Session, email: string) {
  const signUp = await session.post('/api/auth/sign-up/email', { email, password: PASSWORD, name: 'Player' })
  expect(signUp.status).toBe(200)
  const users = await payload.find({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })
  await payload.update({ collection: 'users', id: users.docs[0].id, data: { emailVerified: true }, overrideAccess: true })
  return Number(users.docs[0].id)
}

async function signIn(session: Session, email: string) {
  const response = await session.post('/api/auth/sign-in/email', { email, password: PASSWORD })
  expect(response.status).toBe(200)
  const me = await session.get('/api/auth/get-session')
  return Number(me.json.user.id)
}

const clubsOf = async (owner: number) => (await payload.find({ collection: 'clubs', where: { owner: { equals: owner } }, overrideAccess: true })).docs
async function countOf(collection: 'cards' | 'fixtures' | 'ledger', owner: number) {
  return (await payload.count({ collection, where: { owner: { equals: owner } }, overrideAccess: true })).totalDocs
}

beforeAll(async () => {
  payload = await boot()
})

describe('a guest signing in', () => {
  it('to an account that already has a club gets that club, and the guest club is deleted', async () => {
    // Device A: the player's account and club.
    const deviceA = new Session()
    const accountId = await register(deviceA, 'ada@example.com')
    await signIn(deviceA, 'ada@example.com')
    const original = await found(deviceA, T0, 'Ada United')
    const cards = await countOf('cards', accountId)

    // Device B: a guest plays first, then signs in with the same account.
    const deviceB = await guest('bearer')
    const guestId = deviceB.user!.id
    await found(deviceB, T0, 'Guest Rovers')
    expect(await countOf('cards', guestId)).toBeGreaterThan(0)

    expect(await signIn(deviceB, 'ada@example.com')).toBe(accountId)

    const clubs = await clubsOf(accountId)
    expect(clubs).toHaveLength(1)
    expect(clubs[0].id).toBe(original.club.id)
    expect(clubs[0].name).toBe('Ada United')
    expect(await countOf('cards', accountId)).toBe(cards)
    // Nothing of the guest's is left behind, under either owner.
    expect(await clubsOf(guestId)).toHaveLength(0)
    expect(await countOf('cards', guestId)).toBe(0)
    expect(await countOf('fixtures', guestId)).toBe(0)
    expect(await countOf('ledger', guestId)).toBe(0)

    // And device B now plays the account's club.
    const synced = (await act(deviceB, 'sync', {}, { at: T0 })).json as GameResponse
    expect(synced.club.name).toBe('Ada United')
    expect(synced.cards).toHaveLength(cards)
  })

  it('to a new account keeps the guest club and everything in it', async () => {
    const device = await guest()
    const guestId = device.user!.id
    const made = await found(device, T0, 'Saved Athletic')
    const cards = await countOf('cards', guestId)

    // Registering from the guest session, then signing in once the email is confirmed.
    const accountId = await register(device, 'grace@example.com')
    expect(await signIn(device, 'grace@example.com')).toBe(accountId)

    const clubs = await clubsOf(accountId)
    expect(clubs).toHaveLength(1)
    expect(clubs[0].id).toBe(made.club.id)
    expect(await countOf('cards', accountId)).toBe(cards)
    expect(await clubsOf(guestId)).toHaveLength(0)
  })

  it('before founding a club (signing in from the welcome screen) just signs in', async () => {
    const device = await guest()
    const accountId = await signIn(device, 'ada@example.com')
    const synced = (await act(device, 'sync', {}, { at: T0 })).json as GameResponse
    expect(synced.club.name).toBe('Ada United')
    expect(await clubsOf(accountId)).toHaveLength(1)
  })
})
