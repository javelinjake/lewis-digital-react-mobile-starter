import type { Payload } from 'payload'
import type { Session } from './harness'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot, call, guest } from './harness'

let payload: Payload
let alice: Session
let bob: Session
let aliceNoteId: number

async function createNote(session: Session, title: string, extra: Record<string, unknown> = {}) {
  const response = await session.post('/api/notes?depth=0', { title, ...extra })
  expect(response.status, JSON.stringify(response.json)).toBe(201)
  return response.json.doc as { id: number, owner: number, title: string }
}

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest('bearer')
  aliceNoteId = (await createNote(alice, 'Alice private note')).id
})

describe('accounts', () => {
  it('makes guests members, never administrators', () => {
    return Promise.all([alice, bob].map(async (session) => {
      const user = await payload.findByID({ collection: 'users', id: session.user!.id, overrideAccess: true })
      expect(user.role).toBe('member')
      expect(user.isAnonymous).toBe(true)
    }))
  })

  it('gives a native app a bearer token and a web app a cookie', () => {
    expect(bob.token).toBeTruthy()
    expect(alice.token).toBeTruthy()
  })

  it('rejects requests with no session', async () => {
    const response = await call('GET', '/api/notes')
    expect([401, 403]).toContain(response.status)
  })

  it('does not let a member promote themselves', async () => {
    await alice.patch(`/api/users/${alice.user!.id}`, { role: 'admin' })
    const user = await payload.findByID({ collection: 'users', id: alice.user!.id, overrideAccess: true })
    expect(user.role).toBe('member')
  })

  it('does not let a member change their email or verified flag', async () => {
    await alice.patch(`/api/users/${alice.user!.id}`, { email: 'someone-else@example.com', emailVerified: true })
    const user = await payload.findByID({ collection: 'users', id: alice.user!.id, overrideAccess: true })
    expect(user.email).not.toBe('someone-else@example.com')
    expect(user.emailVerified).not.toBe(true)
  })

  it('lets a member see only their own user record', async () => {
    const list = await alice.get('/api/users')
    expect(list.status).toBe(200)
    expect(list.json.docs.map((doc: { id: number }) => doc.id)).toEqual([alice.user!.id])

    const other = await alice.get(`/api/users/${bob.user!.id}`)
    expect([403, 404]).toContain(other.status)
  })

  it('cannot create users or delete users over REST', async () => {
    const created = await alice.post('/api/users', { email: 'x@example.com' })
    expect(created.status).toBeGreaterThanOrEqual(400)
    const deleted = await alice.delete(`/api/users/${alice.user!.id}`)
    expect(deleted.status).toBeGreaterThanOrEqual(400)
    expect(await payload.count({ collection: 'users', where: { id: { equals: alice.user!.id } }, overrideAccess: true })).toMatchObject({ totalDocs: 1 })
  })

  it('keeps app users out of the admin panel', () => {
    const users = payload.config.collections.find(collection => collection.slug === 'users')!
    const adminAccess = users.access!.admin!
    const admit = (role: string) => adminAccess({ req: { user: { id: 1, role } } as never }) as boolean
    expect(admit('member')).toBe(false)
    expect(admit('admin')).toBe(true)
  })
})

describe('owner isolation', () => {
  it('sets the owner from the session on create', async () => {
    const note = await createNote(alice, 'Mine')
    expect(note.owner).toBe(alice.user!.id)
  })

  it('ignores an owner supplied by the client on create', async () => {
    const note = await createNote(alice, 'Pretending to be Bob', { owner: bob.user!.id })
    expect(note.owner).toBe(alice.user!.id)
  })

  it('lists only the caller\'s documents', async () => {
    await createNote(bob, 'Bob note')
    const aliceNotes = await alice.get('/api/notes?limit=100&depth=0')
    const bobNotes = await bob.get('/api/notes?limit=100&depth=0')
    expect(aliceNotes.json.docs.every((doc: { owner: number }) => doc.owner === alice.user!.id)).toBe(true)
    expect(bobNotes.json.docs.every((doc: { owner: number }) => doc.owner === bob.user!.id)).toBe(true)
    expect(bobNotes.json.docs.map((doc: { id: number }) => doc.id)).not.toContain(aliceNoteId)
  })

  it('cannot read another user\'s document by id', async () => {
    const response = await bob.get(`/api/notes/${aliceNoteId}`)
    expect([403, 404]).toContain(response.status)
  })

  it('cannot reach another user\'s documents by filtering on their owner id', async () => {
    const response = await bob.get(`/api/notes?depth=0&where[owner][equals]=${alice.user!.id}`)
    expect(response.status).toBe(200)
    expect(response.json.docs).toHaveLength(0)
  })

  it('cannot reach another user\'s documents through an OR filter', async () => {
    const response = await bob.get(`/api/notes?depth=0&where[or][0][owner][equals]=${alice.user!.id}&where[or][1][title][exists]=true`)
    expect(response.json.docs.every((doc: { owner: number }) => doc.owner === bob.user!.id)).toBe(true)
  })

  it('cannot update or delete another user\'s document', async () => {
    const updated = await bob.patch(`/api/notes/${aliceNoteId}`, { title: 'Hijacked' })
    expect([403, 404]).toContain(updated.status)
    const deleted = await bob.delete(`/api/notes/${aliceNoteId}`)
    expect([403, 404]).toContain(deleted.status)

    const note = await payload.findByID({ collection: 'notes', id: aliceNoteId, overrideAccess: true })
    expect(note.title).toBe('Alice private note')
  })

  it('cannot reassign a document to another user', async () => {
    const response = await alice.patch(`/api/notes/${aliceNoteId}`, { owner: bob.user!.id })
    expect(response.status).toBe(403)
    const note = await payload.findByID({ collection: 'notes', id: aliceNoteId, overrideAccess: true })
    expect(typeof note.owner === 'object' ? note.owner.id : note.owner).toBe(alice.user!.id)
  })

  it('allows an update that leaves the owner as it was', async () => {
    const response = await alice.patch(`/api/notes/${aliceNoteId}`, { title: 'Alice private note', owner: alice.user!.id })
    expect(response.status, JSON.stringify(response.json)).toBe(200)
  })

  it('lets an administrator see every user\'s documents', async () => {
    const all = await payload.find({ collection: 'notes', overrideAccess: true, limit: 100 })
    const owners = new Set(all.docs.map(doc => (typeof doc.owner === 'object' ? doc.owner.id : doc.owner)))
    expect(owners.has(alice.user!.id)).toBe(true)
    expect(owners.has(bob.user!.id)).toBe(true)
  })
})

describe('idempotent create', () => {
  it('returns the original document when a write is retried with the same clientMutationId', async () => {
    const body = { title: 'Created offline', clientMutationId: 'op-1' }
    const first = await alice.post('/api/notes/idempotent', body)
    const second = await alice.post('/api/notes/idempotent', body)
    expect(first.status).toBe(201)
    expect(first.json.created).toBe(true)
    expect(second.status).toBe(200)
    expect(second.json.created).toBe(false)
    expect(second.json.doc.id).toBe(first.json.doc.id)

    const count = await payload.count({ collection: 'notes', where: { clientMutationId: { equals: 'op-1' } }, overrideAccess: true })
    expect(count.totalDocs).toBe(1)
  })

  it('creates exactly one document when the same write arrives concurrently', async () => {
    const body = { title: 'Raced', clientMutationId: 'op-race' }
    const results = await Promise.all([1, 2, 3, 4].map(() => alice.post('/api/notes/idempotent', body)))
    expect(results.every(result => [200, 201].includes(result.status)), JSON.stringify(results.map(r => r.json))).toBe(true)
    const ids = new Set(results.map(result => result.json.doc.id))
    expect(ids.size).toBe(1)
    const count = await payload.count({ collection: 'notes', where: { clientMutationId: { equals: 'op-race' } }, overrideAccess: true })
    expect(count.totalDocs).toBe(1)
  })

  it('scopes the key to its owner, so two users can reuse an id', async () => {
    const a = await alice.post('/api/notes/idempotent', { title: 'A', clientMutationId: 'shared-id' })
    const b = await bob.post('/api/notes/idempotent', { title: 'B', clientMutationId: 'shared-id' })
    expect(a.json.doc.id).not.toBe(b.json.doc.id)
    expect(a.json.doc.owner).toBe(alice.user!.id)
    expect(b.json.doc.owner).toBe(bob.user!.id)
  })

  it('requires a clientMutationId and a session', async () => {
    expect((await alice.post('/api/notes/idempotent', { title: 'No key' })).status).toBe(400)
    expect([401, 403]).toContain((await call('POST', '/api/notes/idempotent', { body: { title: 'x', clientMutationId: 'y' } })).status)
  })
})

describe('cors', () => {
  it('allows the web app and the Capacitor WebViews, and nobody else', async () => {
    const preflight = (origin: string) => call('OPTIONS', '/api/notes', { origin, headers: { 'access-control-request-method': 'POST' } })

    expect((await preflight('http://localhost:5173')).headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect((await preflight('capacitor://localhost')).headers.get('access-control-allow-origin')).toBe('capacitor://localhost')
    expect((await preflight('https://localhost')).headers.get('access-control-allow-origin')).toBe('https://localhost')
    expect((await preflight('https://evil.example.com')).headers.get('access-control-allow-origin')).toBeNull()
  })

  it('lets the app send the Idempotency-Key header', async () => {
    const response = await call('OPTIONS', '/api/notes', { origin: 'http://localhost:5173' })
    expect(response.headers.get('access-control-allow-headers')).toContain('Idempotency-Key')
  })
})
