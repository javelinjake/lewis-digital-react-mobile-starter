import type { FcmSender } from '@ld/backend'
import type { Payload } from 'payload'
import type { Session } from './harness'
import { sendPushToUser } from '@ld/backend'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot, call, guest } from './harness'

let payload: Payload
let alice: Session
let bob: Session

const devicesFor = async (owner: number) => (await payload.find({ collection: 'devices', where: { owner: { equals: owner } }, overrideAccess: true, depth: 0 })).docs
const register = (session: Session, token: string, platform = 'ios') => session.post('/api/actions/push/register', { token, platform, appVersion: '1.0.0' })

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest('bearer')
})

describe('push device registration', () => {
  it('needs a session and a valid body', async () => {
    expect((await call('POST', '/api/actions/push/register', { body: { token: 't', platform: 'ios' } })).status).toBe(401)
    expect((await alice.post('/api/actions/push/register', { platform: 'ios' })).status).toBe(400)
    expect((await alice.post('/api/actions/push/register', { token: 't', platform: 'windows' })).status).toBe(400)
  })

  it('saves one row per device, however often the app registers', async () => {
    expect((await register(alice, 'phone-1')).status).toBe(200)
    expect((await register(alice, 'phone-1')).status).toBe(200)
    const rows = await devicesFor(alice.user!.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ token: 'phone-1', platform: 'ios', appVersion: '1.0.0' })
  })

  it('moves a token to whoever signed in on that phone last', async () => {
    await register(bob, 'phone-1')
    expect(await devicesFor(alice.user!.id)).toHaveLength(0)
    expect(await devicesFor(bob.user!.id)).toHaveLength(1)
  })

  it('lets members read only their own devices and write none directly', async () => {
    await register(alice, 'phone-2', 'android')
    const listed = await alice.get('/api/devices?depth=0')
    expect(listed.json.docs.map((doc: { token: string }) => doc.token)).toEqual(['phone-2'])

    expect((await alice.post('/api/devices', { token: 'forged', platform: 'ios', owner: bob.user!.id })).status).toBe(403)
    const bobsDevice = (await devicesFor(bob.user!.id))[0]
    expect((await alice.delete(`/api/devices/${bobsDevice.id}`)).status).not.toBe(200)
    expect(await devicesFor(bob.user!.id)).toHaveLength(1)
  })

  it('unregisters only the caller\'s own row', async () => {
    await alice.post('/api/actions/push/unregister', { token: 'phone-1' })
    expect(await devicesFor(bob.user!.id)).toHaveLength(1)
    await bob.post('/api/actions/push/unregister', { token: 'phone-1' })
    expect(await devicesFor(bob.user!.id)).toHaveLength(0)
  })
})

describe('sending', () => {
  it('reports that push is not set up when the api has no Firebase key', async () => {
    const response = await alice.post('/api/actions/push/test', {})
    expect(response.status).toBe(200)
    expect(response.json).toMatchObject({ configured: false, sent: 0 })
  })

  it('sends to every device of that user only, and drops tokens Firebase says are dead', async () => {
    await register(alice, 'alive')
    await register(alice, 'gone')
    await register(bob, 'bobs-phone')
    const tokens: string[] = []
    const sender: FcmSender = {
      send: async (token) => {
        tokens.push(token)
        return token === 'gone' ? 'unregistered' : 'sent'
      },
    }

    const summary = await sendPushToUser(payload, alice.user!.id, { title: 'Hi', body: 'There' }, { sender })

    expect(tokens.sort()).toEqual(['alive', 'gone', 'phone-2'])
    expect(summary).toEqual({ configured: true, sent: 2, removed: 1, failed: 0 })
    expect((await devicesFor(alice.user!.id)).map(row => row.token).sort()).toEqual(['alive', 'phone-2'])
  })
})
