import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot, call, guest } from './harness'

let payload: Payload

const checksum = 'b'.repeat(64)
function publish(body: Record<string, unknown>, secret = 'test-ota-secret') {
  return call('POST', '/api/ota/bundles', { body, headers: { authorization: `Bearer ${secret}` }, origin: null })
}
const check = (body: Record<string, unknown>) => call('POST', '/api/ota/check', { body, origin: null })
const device = { app_id: 'uk.co.lewisdigital.template', version_build: '1.0.0', version_name: 'builtin', platform: 'ios', device_id: 'device-1' }

beforeAll(async () => {
  payload = await boot()
})

describe('live updates', () => {
  it('only records bundles with the publish secret', async () => {
    const body = { appId: device.app_id, nativeVersion: '1.0.0', version: '1.0.0+1', url: 'https://cdn.example.com/1.zip', checksum }
    expect((await call('POST', '/api/ota/bundles', { body, origin: null })).status).toBe(401)
    expect((await publish(body, 'wrong')).status).toBe(401)
    expect((await publish({ ...body, url: 'http://cdn.example.com/1.zip' })).status).toBe(400)
    expect((await publish({ ...body, checksum: 'nope' })).status).toBe(400)
  })

  it('tells a shell with nothing published that it is up to date', async () => {
    const response = await check(device)
    expect(response.status).toBe(200)
    expect(response.json).toMatchObject({ kind: 'up_to_date' })
  })

  it('offers the newest bundle to shells of the same store version only', async () => {
    expect((await publish({ appId: device.app_id, nativeVersion: '1.0.0', version: '1.0.0+1', url: 'https://cdn.example.com/1.zip', checksum })).status).toBe(201)
    expect((await publish({ appId: device.app_id, nativeVersion: '1.0.0', version: '1.0.0+2', url: 'https://cdn.example.com/2.zip', checksum })).status).toBe(201)

    expect((await check(device)).json).toEqual({ version: '1.0.0+2', url: 'https://cdn.example.com/2.zip', checksum })
    expect((await check({ ...device, version_build: '0.9.0' })).json).toMatchObject({ kind: 'up_to_date' })
    expect((await check({ ...device, app_id: `${device.app_id}.staging` })).json).toMatchObject({ kind: 'up_to_date' })
    expect((await check({ ...device, version_name: '1.0.0+2' })).json).toMatchObject({ kind: 'up_to_date' })
  })

  it('rolls devices back when bundles are switched off', async () => {
    await payload.update({ collection: 'app-bundles' as never, where: { appId: { equals: device.app_id } }, data: { active: false } as never, overrideAccess: true })
    expect((await check({ ...device, version_name: '1.0.0+2' })).json).toEqual({ version: 'builtin' })
    expect((await check(device)).json).toMatchObject({ kind: 'up_to_date' })
  })

  it('is not readable or writable by members', async () => {
    const member = await guest()
    expect((await member.get('/api/app-bundles')).status).toBe(403)
    expect((await member.post('/api/app-bundles', { appId: 'x', nativeVersion: '1', version: '1', url: 'https://x', checksum })).status).toBe(403)
  })

  it('refuses a malformed check', async () => {
    expect((await check({ platform: 'ios' })).status).toBe(400)
  })
})
