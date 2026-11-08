import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot, call } from './harness'

let payload: Payload

beforeAll(async () => {
  payload = await boot()
})

describe('gET /api/cron/cleanup', () => {
  it('refuses callers without the cron secret', async () => {
    expect((await call('GET', '/api/cron/cleanup', { origin: null })).status).toBe(401)
    expect((await call('GET', '/api/cron/cleanup', { origin: null, headers: { authorization: 'Bearer nope' } })).status).toBe(401)
  })

  it('prunes old rate-limit rows and idempotency keys, and keeps recent ones', async () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const user = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true })).docs[0]

    await payload.create({ collection: 'action-throttles', overrideAccess: true, data: { key: 'old', createdAt: old } as never })
    await payload.create({ collection: 'action-throttles', overrideAccess: true, data: { key: 'recent' } })
    await payload.create({ collection: 'idempotency-keys', overrideAccess: true, data: { owner: user.id, route: 'POST /x', key: 'old-key', status: 'done', createdAt: old } as never })
    await payload.create({ collection: 'idempotency-keys', overrideAccess: true, data: { owner: user.id, route: 'POST /x', key: 'new-key', status: 'done' } as never })

    const response = await call('GET', '/api/cron/cleanup', { origin: null, headers: { authorization: 'Bearer test-cron-secret' } })
    expect(response.status).toBe(200)
    expect(response.json.removed.rateLimits).toBeGreaterThanOrEqual(1)
    expect(response.json.removed.idempotencyKeys).toBeGreaterThanOrEqual(1)

    expect((await payload.count({ collection: 'action-throttles', where: { key: { equals: 'old' } }, overrideAccess: true })).totalDocs).toBe(0)
    expect((await payload.count({ collection: 'action-throttles', where: { key: { equals: 'recent' } }, overrideAccess: true })).totalDocs).toBe(1)
    expect((await payload.count({ collection: 'idempotency-keys', where: { key: { equals: 'new-key' } }, overrideAccess: true })).totalDocs).toBe(1)
  })

  it('reports health', async () => {
    const response = await call('GET', '/api/health', { origin: null })
    expect(response.status).toBe(200)
    expect(response.json).toEqual({ ok: true })
  })
})
