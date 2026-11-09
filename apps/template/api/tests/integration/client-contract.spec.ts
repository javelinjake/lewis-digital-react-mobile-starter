import type { TokenStorage } from '@ld/api-client'
import type { Payload } from 'payload'
import { ApiError, createApiClient } from '@ld/api-client'
import { readLatestCapturedEmail } from '@ld/backend'
import { beforeAll, describe, expect, it } from 'vitest'
import { boot, call, inProcessFetch } from './harness'

// The real client against the real backend: if a route, body or header drifts apart, this fails.

interface Note { id: number, title: string, body?: string | null, owner: number, clientMutationId?: string | null }

let payload: Payload

function memoryStorage(): TokenStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    get: async key => data.get(key) ?? null,
    set: async (key, value) => { data.set(key, value) },
    remove: async (key) => { data.delete(key) },
  }
}

const web = () => createApiClient({ baseUrl: '', mode: 'cookie', fetch: inProcessFetch() })
const native = (storage = memoryStorage()) => ({ storage, client: createApiClient({ baseUrl: 'http://localhost:3001', mode: 'token', tokenStorage: storage, fetch: inProcessFetch() }) })

beforeAll(async () => {
  payload = await boot()
})

describe.each([
  ['web (cookie)', () => ({ client: web(), storage: undefined })],
  ['native (bearer token)', () => native()],
] as const)('%s', (_name, make) => {
  it('signs in as a guest and reads who it is from get-session', async () => {
    const { client } = make()
    expect(await client.auth.getSession()).toBeNull()

    const guest = await client.auth.signInAnonymously()
    expect(guest).toMatchObject({ isAnonymous: true, role: 'member' })
    expect(typeof guest.id).toBe('string')
    expect(await client.auth.getSession()).toMatchObject({ id: guest.id })
  })

  it('creates, lists, updates and deletes the caller\'s own documents', async () => {
    const { client } = make()
    const me = await client.auth.signInAnonymously()
    const notes = client.collection<Note>('notes')

    const created = await notes.create({ title: 'First', body: 'Hello' })
    expect(created).toMatchObject({ title: 'First', owner: Number(me.id) })

    const listed = await notes.find({ where: { title: { equals: 'First' } } })
    expect(listed.docs.map(note => note.id)).toEqual([created.id])

    const updated = await notes.update(created.id, { title: 'Renamed' })
    expect(updated.title).toBe('Renamed')

    await notes.remove(created.id)
    expect((await notes.find()).docs.find(note => note.id === created.id)).toBeUndefined()
  })

  it('applies a retried idempotent create once', async () => {
    const { client } = make()
    await client.auth.signInAnonymously()
    const notes = client.collection<Note>('notes')

    const first = await notes.createIdempotent({ title: 'From the outbox', clientMutationId: 'op-contract-1' })
    const again = await notes.createIdempotent({ title: 'From the outbox', clientMutationId: 'op-contract-1' })

    expect(again.id).toBe(first.id)
    expect((await notes.find({ where: { clientMutationId: { equals: 'op-contract-1' } } })).totalDocs).toBe(1)
  })

  it('runs a server action once per Idempotency-Key', async () => {
    const { client } = make()
    await client.auth.signInAnonymously()
    const notes = client.collection<Note>('notes')
    const source = await notes.create({ title: 'Source' })

    const first = await client.action<{ doc: Note }>('/actions/duplicate-note', { id: source.id }, 'contract-key')
    const second = await client.action<{ doc: Note }>('/actions/duplicate-note', { id: source.id }, 'contract-key')

    expect(second.doc.id).toBe(first.doc.id)
    expect((await notes.find({ where: { title: { equals: 'Source (copy)' } } })).totalDocs).toBe(1)
  })

  it('cannot reach another person\'s document, and the error carries a numeric status', async () => {
    const alice = make().client
    const bob = make().client
    await alice.auth.signInAnonymously()
    await bob.auth.signInAnonymously()
    const note = await alice.collection<Note>('notes').create({ title: 'Private' })

    const error = await bob.collection<Note>('notes').findById(note.id).catch(e => e)
    expect(error).toBeInstanceOf(ApiError)
    expect([403, 404]).toContain(error.status)
  })

  it('exports then deletes the account, after which the session is gone', async () => {
    const { client } = make()
    await client.auth.signInAnonymously()
    await client.collection<Note>('notes').create({ title: 'Mine to take with me' })

    const exported = await client.auth.exportAccount() as { data: { notes: Note[] } }
    expect(exported.data.notes.map(note => note.title)).toContain('Mine to take with me')

    await client.auth.deleteAccount()
    expect(await client.auth.getSession()).toBeNull()
  })

  it('signs out', async () => {
    const { client } = make()
    await client.auth.signInAnonymously()
    await client.auth.signOut()
    expect(await client.auth.getSession()).toBeNull()
  })
})

describe('native token handling', () => {
  it('stores the token on sign-in and clears it on sign-out', async () => {
    const { client, storage } = native()
    await client.auth.signInAnonymously()
    expect(storage.data.get('session-token')).toBeTruthy()

    await client.auth.signOut()
    expect(storage.data.has('session-token')).toBe(false)
  })

  it('restores the session in a new client from the stored token (an app relaunch)', async () => {
    const first = native()
    const me = await first.client.auth.signInAnonymously()

    const relaunched = native(first.storage)
    expect(await relaunched.client.auth.getSession()).toMatchObject({ id: me.id })
  })
})

describe('email accounts', () => {
  it('signs up, needs the emailed link, then signs in', async () => {
    const { client } = native()
    const email = 'contract.user@example.com'
    const password = 'a-long-enough-password'

    expect(await client.auth.signUpWithEmail({ email, password, name: 'Contract' })).toEqual({ needsVerification: true })
    await expect(client.auth.signInWithEmail(email, password)).rejects.toBeInstanceOf(ApiError)

    const mail = await readLatestCapturedEmail(process.env.EMAIL_CAPTURE_DIR!, email)
    const link = new URL(mail!.text.match(/https?:\/\/\S+/)![0])
    await call('GET', `${link.pathname}${link.search}`)

    const user = await client.auth.signInWithEmail(email, password)
    expect(user).toMatchObject({ email, isAnonymous: false, emailVerified: true })
  })

  it('asks for a password reset email and accepts the new password', async () => {
    const { client } = native()
    const email = 'reset.me@example.com'
    await client.auth.signUpWithEmail({ email, password: 'the-first-password-1', name: 'Reset' })
    const verify = new URL((await readLatestCapturedEmail(process.env.EMAIL_CAPTURE_DIR!, email))!.text.match(/https?:\/\/\S+/)![0])
    await call('GET', `${verify.pathname}${verify.search}`)

    await client.auth.requestPasswordReset(email, 'http://localhost:5173/reset-password')
    const reset = await readLatestCapturedEmail(process.env.EMAIL_CAPTURE_DIR!, email)
    expect(reset!.subject).toContain('Reset')
    const token = reset!.text.match(/reset-password\/([^?\s]+)/)?.[1]
    expect(token).toBeTruthy()

    await client.auth.resetPassword(token!, 'the-second-password-2')
    expect(await client.auth.signInWithEmail(email, 'the-second-password-2')).toMatchObject({ email })
    await expect(client.auth.signInWithEmail(email, 'the-first-password-1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('database', () => {
  it('uses numeric ids for Payload documents while Better Auth reports strings', async () => {
    const { client } = native()
    const me = await client.auth.signInAnonymously()
    const row = await payload.findByID({ collection: 'users', id: Number(me.id), overrideAccess: true })
    expect(typeof row.id).toBe('number')
    expect(typeof me.id).toBe('string')
  })
})
