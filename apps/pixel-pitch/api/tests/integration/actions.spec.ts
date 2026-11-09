import type { Payload } from 'payload'
import type { Session } from './harness'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot, call, guest } from './harness'

let payload: Payload
let alice: Session
let bob: Session
let noteId: number

function duplicate(session: Session, id: number | string, key?: string) {
  return session.post('/api/actions/duplicate-note', { id }, { headers: key ? { 'idempotency-key': key } : {} })
}

const copies = () => payload.count({ collection: 'notes', where: { title: { equals: 'Source (copy)' } }, overrideAccess: true })

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest()
  const created = await alice.post('/api/notes?depth=0', { title: 'Source', body: 'Original' })
  noteId = created.json.doc.id
})

describe('defineAction', () => {
  it('requires a session', async () => {
    const response = await call('POST', '/api/actions/duplicate-note', { body: { id: noteId }, headers: { 'idempotency-key': 'k-anon' } })
    expect(response.status).toBe(401)
  })

  it('requires an Idempotency-Key header', async () => {
    const response = await duplicate(alice, noteId)
    expect(response.status).toBe(400)
    expect(JSON.stringify(response.json)).toContain('Idempotency-Key')
  })

  it('applies the action once and replays the first answer for a repeated key', async () => {
    const before = (await copies()).totalDocs
    const first = await duplicate(alice, noteId, 'dup-1')
    const second = await duplicate(alice, noteId, 'dup-1')

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.headers.get('idempotent-replay')).toBe('true')
    expect(second.json.doc.id).toBe(first.json.doc.id)
    expect((await copies()).totalDocs).toBe(before + 1)
  })

  it('applies a repeated key once even when the requests arrive together', async () => {
    const before = (await copies()).totalDocs
    const results = await Promise.all([1, 2, 3, 4].map(() => duplicate(alice, noteId, 'dup-race')))
    const created = results.filter(result => result.status === 201 && result.headers.get('idempotent-replay') !== 'true')
    const conflicts = results.filter(result => result.status === 409)

    expect(created).toHaveLength(1)
    expect(created.length + conflicts.length + results.filter(r => r.headers.get('idempotent-replay') === 'true').length).toBe(4)
    expect((await copies()).totalDocs).toBe(before + 1)
  })

  it('treats the same key from two different users as two different requests', async () => {
    const mine = await alice.post('/api/notes', { title: 'Source' })
    const a = await duplicate(alice, mine.json.doc.id, 'shared-key')
    const b = await duplicate(bob, mine.json.doc.id, 'shared-key')
    expect(a.status).toBe(201)
    expect(b.status).not.toBe(201)
  })

  it('answers with the user\'s own view: another user\'s document is not found, and nothing is written', async () => {
    const before = (await copies()).totalDocs
    const response = await duplicate(bob, noteId, 'bob-steals')
    expect(response.status).toBe(404)
    expect((await copies()).totalDocs).toBe(before)
  })

  it('releases the key when the action fails, so the client can retry it', async () => {
    const missing = await duplicate(alice, 999_999, 'retry-me')
    expect(missing.status).toBe(404)

    const stored = await payload.count({ collection: 'idempotency-keys', where: { key: { equals: 'retry-me' } }, overrideAccess: true })
    expect(stored.totalDocs).toBe(0)

    const retried = await duplicate(alice, noteId, 'retry-me')
    expect(retried.status).toBe(201)
  })

  it('rejects an invalid request before doing anything', async () => {
    const response = await alice.post('/api/actions/duplicate-note', {}, { headers: { 'idempotency-key': 'bad-body' } })
    expect(response.status).toBe(400)
  })

  it('does not let a client read or write the idempotency records', async () => {
    expect((await alice.get('/api/idempotency-keys')).json?.docs ?? []).toHaveLength(0)
    expect((await alice.post('/api/idempotency-keys', { key: 'x', route: 'x', owner: alice.user!.id })).status).toBeGreaterThanOrEqual(400)
  })
})

describe('rate limiting', () => {
  it('stops a user who goes over the limit, and only that user', async () => {
    const spammer = await guest()
    const calm = await guest()
    const note = await spammer.post('/api/notes', { title: 'Source' })

    const results = []
    for (let i = 0; i < 32; i++)
      results.push(await duplicate(spammer, note.json.doc.id, `spam-${i}`))

    expect(results.filter(result => result.status === 201).length).toBeLessThanOrEqual(30)
    expect(results.some(result => result.status === 429)).toBe(true)

    const calmNote = await calm.post('/api/notes', { title: 'Calm source' })
    expect((await duplicate(calm, calmNote.json.doc.id, 'calm-1')).status).toBe(201)
  })
})
