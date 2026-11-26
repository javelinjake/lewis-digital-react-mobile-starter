import type { GameResponse } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import type { Session } from './harness'
import { DEFAULT_CONFIG, FREE_KITS } from '@ld/pixel-pitch-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { act, found, newClub } from './game-helpers'
import { boot, guest } from './harness'

const T0 = Date.UTC(2026, 10, 20, 12)
const kit = DEFAULT_CONFIG.shop.kits[0]

let payload: Payload
let alice: Session
let bob: Session

async function setGems(session: Session, gems: number) {
  const current = (await act(session, 'sync', {}, { at: T0 })).json as GameResponse
  await payload.update({ collection: 'clubs', id: current.club.id, data: { state: { ...current.club.state, idle: { ...current.club.state.idle, gems } } as never }, overrideAccess: true })
}

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest('bearer')
  await found(alice, T0)
  await found(bob, T0, 'Bob FC')
})

describe('the shop', () => {
  it('starts a club only in one of the free kits', async () => {
    const carol = await guest()
    const premium = await act(carol, 'club', { ...newClub, kitPrimary: kit.primary, kitSecondary: kit.secondary }, { at: T0 })
    expect(premium.status).toBe(400)
    const free = await act(carol, 'club', { ...newClub, kitPrimary: FREE_KITS[3][0], kitSecondary: FREE_KITS[3][1] }, { at: T0 })
    expect(free.status).toBe(201)
  })

  it('will not put a premium kit on a club that has not bought it', async () => {
    const worn = await act(alice, 'kit', { kitPrimary: kit.primary, kitSecondary: kit.secondary }, { at: T0 })
    expect(worn.status).toBe(400)
    const free = await act(alice, 'kit', { kitPrimary: FREE_KITS[1][0], kitSecondary: FREE_KITS[1][1] }, { at: T0 })
    expect(free.status).toBe(200)
    expect((free.json as GameResponse).club).toMatchObject({ kitPrimary: FREE_KITS[1][0], kitSecondary: FREE_KITS[1][1] })
  })

  it('sells a kit for gems, once, and then it can be worn', async () => {
    await setGems(alice, kit.gems - 1)
    expect((await act(alice, 'shop/kit', { kitId: kit.id }, { at: T0 })).status).toBe(400)
    await setGems(alice, kit.gems + 10)
    const bought = await act(alice, 'shop/kit', { kitId: kit.id }, { at: T0 })
    expect(bought.status).toBe(200)
    expect((bought.json as GameResponse).club.state).toMatchObject({ cosmetics: [kit.id], idle: { gems: 10 } })
    expect((await act(alice, 'shop/kit', { kitId: kit.id }, { at: T0 })).status).toBe(400)
    const worn = await act(alice, 'kit', { kitPrimary: kit.primary, kitSecondary: kit.secondary }, { at: T0 })
    expect(worn.status).toBe(200)
    expect((worn.json as GameResponse).club.kitPrimary).toBe(kit.primary)
    const row = await payload.find({ collection: 'ledger', where: { and: [{ owner: { equals: alice.user!.id } }, { reason: { equals: 'shop' } }] }, depth: 0, overrideAccess: true })
    expect(row.docs[0]).toMatchObject({ currency: 'gems', amount: -kit.gems, ref: kit.id })
  })

  it('keeps one club\'s purchase its own', async () => {
    expect((await act(bob, 'kit', { kitPrimary: kit.primary, kitSecondary: kit.secondary }, { at: T0 })).status).toBe(400)
  })
})
