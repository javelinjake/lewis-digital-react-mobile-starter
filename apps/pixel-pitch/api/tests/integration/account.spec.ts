import type { Payload } from 'payload'
import type { Session } from './harness'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot, call, guest } from './harness'

let payload: Payload
let leaver: Session
let stayer: Session

beforeAll(async () => {
  payload = await boot()
  leaver = await guest()
  stayer = await guest()
  for (const title of ['One', 'Two', 'Three'])
    await leaver.post('/api/notes', { title })
  await stayer.post('/api/notes', { title: 'Keeps' })
  await leaver.post('/api/actions/duplicate-note', { id: (await leaver.get('/api/notes')).json.docs[0].id }, { headers: { 'idempotency-key': 'before-leaving' } })
  await payload.create({
    collection: 'entitlements',
    overrideAccess: true,
    data: { owner: leaver.user!.id, entitlement: 'club_pass', active: true },
  })
})

describe('gET /api/account/export', () => {
  it('requires a session', async () => {
    expect((await call('GET', '/api/account/export')).status).toBe(401)
  })

  it('returns only the caller\'s data as a download', async () => {
    const response = await leaver.get('/api/account/export')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('attachment')

    const notes = response.json.data.notes as Array<{ owner: number }>
    expect(notes.length).toBe(4)
    expect(notes.every(note => note.owner === leaver.user!.id)).toBe(true)
    expect(response.json.data.entitlements).toHaveLength(1)
    expect(response.json.account.id).toBe(leaver.user!.id)
    expect(JSON.stringify(response.json)).not.toContain('token')
  })
})

describe('dELETE /api/account', () => {
  it('requires a session', async () => {
    expect((await call('DELETE', '/api/account')).status).toBe(401)
  })

  it('removes the user and everything they own, and leaves other users alone', async () => {
    const id = leaver.user!.id
    const response = await leaver.delete('/api/account')
    expect(response.status, JSON.stringify(response.json)).toBe(200)

    const count = (collection: 'users' | 'notes' | 'entitlements' | 'idempotency-keys' | 'sessions' | 'accounts') =>
      payload.count({
        collection,
        overrideAccess: true,
        where: { [collection === 'users' ? 'id' : collection === 'sessions' || collection === 'accounts' ? 'user' : 'owner']: { equals: id } },
      })

    expect((await count('users')).totalDocs).toBe(0)
    expect((await count('notes')).totalDocs).toBe(0)
    expect((await count('entitlements')).totalDocs).toBe(0)
    expect((await count('idempotency-keys')).totalDocs).toBe(0)
    expect((await count('sessions')).totalDocs).toBe(0)
    expect((await count('accounts')).totalDocs).toBe(0)

    const kept = await stayer.get('/api/notes')
    expect(kept.json.docs).toHaveLength(1)
  })

  it('leaves the old session useless', async () => {
    const response = await leaver.get('/api/notes')
    expect([401, 403]).toContain(response.status)
  })
})
