import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient, toQueryString } from '../../src'

interface Call { url: string, init: RequestInit & { headers: Record<string, string> } }

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    const call = { url, init: init as Call['init'] }
    calls.push(call)
    return respond(call)
  })
  return { fn: fn as unknown as typeof fetch, calls }
}

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, init)

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: string) => { data.set(key, value) },
    remove: async (key: string) => { data.delete(key) },
  }
}

const rawUser = { id: 7, email: 'a@example.com', name: 'Ada', role: 'member', isAnonymous: false, emailVerified: true }

describe('toQueryString', () => {
  it('builds Payload bracket syntax for nested objects and arrays', () => {
    expect(toQueryString({ where: { owner: { equals: 3 } }, limit: 10 })).toBe('where[owner][equals]=3&limit=10')
    expect(toQueryString({ where: { or: [{ a: { equals: 1 } }, { b: { equals: 2 } }] } })).toBe('where[or][0][a][equals]=1&where[or][1][b][equals]=2')
  })

  it('skips undefined, keeps false and 0, and encodes values', () => {
    expect(toQueryString({ a: undefined, b: false, c: 0, d: 'x y&z' })).toBe('b=false&c=0&d=x%20y%26z')
  })
})

describe('cookie mode (web)', () => {
  it('sends cookies, never an Authorization header, and reads the session from get-session', async () => {
    const { fn, calls } = fakeFetch(() => json({ session: {}, user: rawUser }))
    const client = createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn })

    const user = await client.auth.getSession()

    expect(calls[0].url).toBe('/api/auth/get-session')
    expect(calls[0].init.credentials).toBe('include')
    expect(calls[0].init.headers.Authorization).toBeUndefined()
    expect(user).toEqual({ id: '7', email: 'a@example.com', name: 'Ada', image: null, role: 'member', isAnonymous: false, emailVerified: true })
  })

  it('returns null when nobody is signed in', async () => {
    const { fn } = fakeFetch(() => new Response('null', { headers: { 'content-type': 'application/json' } }))
    expect(await createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn }).auth.getSession()).toBeNull()
  })

  it('always reports ids as strings and never trusts a role it does not know', async () => {
    const { fn } = fakeFetch(() => json({ user: { ...rawUser, id: 42, role: 'superuser' } }))
    const user = await createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn }).auth.getSession()
    expect(user?.id).toBe('42')
    expect(user?.role).toBe('member')
  })
})

describe('token mode (native)', () => {
  it('keeps the issued token in secure storage and sends it as a bearer token afterwards', async () => {
    const storage = memoryStorage()
    const { fn, calls } = fakeFetch(({ url }) => url.includes('sign-in/anonymous')
      ? json({ token: 'x', user: { ...rawUser, isAnonymous: true } }, { headers: { 'set-auth-token': 'signed.token' } })
      : json([]))
    const client = createApiClient({ baseUrl: 'https://api.example.com', mode: 'token', tokenStorage: storage, fetch: fn })

    await client.auth.signInAnonymously()
    expect(storage.data.get('session-token')).toBe('signed.token')

    await client.collection('notes').find()
    expect(calls[1].init.headers.Authorization).toBe('Bearer signed.token')
    expect(calls[1].init.credentials).toBe('omit')
    expect(calls[1].url.startsWith('https://api.example.com/api/notes')).toBe(true)
  })

  it('reads a token saved by an earlier launch', async () => {
    const storage = memoryStorage()
    storage.data.set('session-token', 'from-last-launch')
    const { fn, calls } = fakeFetch(() => json({ user: rawUser }))
    await createApiClient({ baseUrl: 'https://api.example.com', mode: 'token', tokenStorage: storage, fetch: fn }).auth.getSession()
    expect(calls[0].init.headers.Authorization).toBe('Bearer from-last-launch')
  })

  it('replaces the guest token with the new one when a guest signs in', async () => {
    const storage = memoryStorage()
    storage.data.set('session-token', 'guest.token')
    const { fn, calls } = fakeFetch(() => json({ user: rawUser }, { headers: { 'set-auth-token': 'account.token' } }))
    const client = createApiClient({ baseUrl: 'https://api.example.com', mode: 'token', tokenStorage: storage, fetch: fn })

    await client.auth.signInWithEmail('a@example.com', 'a-long-enough-password')

    // The guest token is sent with the sign-in so the backend can carry the guest's data into the account.
    expect(calls[0].init.headers.Authorization).toBe('Bearer guest.token')
    expect(storage.data.get('session-token')).toBe('account.token')
  })

  it('forgets the token on sign-out even when the server cannot be reached', async () => {
    const storage = memoryStorage()
    storage.data.set('session-token', 'abc')
    const fn = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const client = createApiClient({ baseUrl: 'https://api.example.com', mode: 'token', tokenStorage: storage, fetch: fn })

    await expect(client.auth.signOut()).rejects.toBeInstanceOf(TypeError)
    expect(storage.data.has('session-token')).toBe(false)
  })

  it('forgets the token after the account is deleted', async () => {
    const storage = memoryStorage()
    storage.data.set('session-token', 'abc')
    const { fn } = fakeFetch(() => json({ deleted: true }))
    await createApiClient({ baseUrl: '', mode: 'token', tokenStorage: storage, fetch: fn }).auth.deleteAccount()
    expect(storage.data.has('session-token')).toBe(false)
  })
})

describe('errors', () => {
  it('turns Payload and Better Auth error bodies into an ApiError with a numeric status', async () => {
    const payloadError = fakeFetch(() => json({ errors: [{ message: 'Too many requests.' }] }, { status: 429 }))
    const authError = fakeFetch(() => json({ message: 'Invalid email or password' }, { status: 401 }))

    const a = await createApiClient({ baseUrl: '', mode: 'cookie', fetch: payloadError.fn }).collection('notes').find().catch(e => e)
    const b = await createApiClient({ baseUrl: '', mode: 'cookie', fetch: authError.fn }).auth.signInWithEmail('x', 'y').catch(e => e)

    expect(a).toBeInstanceOf(ApiError)
    expect(a).toMatchObject({ status: 429, message: 'Too many requests.' })
    expect(b).toMatchObject({ status: 401, message: 'Invalid email or password' })
  })

  it('does not wrap a network failure, so the outbox still sees a TypeError', async () => {
    const fn = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const error = await createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn }).collection('notes').find().catch(e => e)
    expect(error).toBeInstanceOf(TypeError)
    expect(error).not.toBeInstanceOf(ApiError)
  })

  it('reports a lost session on data requests but not on a failed sign-in', async () => {
    const onUnauthorized = vi.fn()
    const { fn } = fakeFetch(() => json({ message: 'Unauthorized' }, { status: 401 }))
    const client = createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn, onUnauthorized })

    await client.auth.signInWithEmail('x', 'wrong').catch(() => undefined)
    expect(onUnauthorized).not.toHaveBeenCalled()

    await client.collection('notes').find().catch(() => undefined)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('falls back to a plain message when the body has none', async () => {
    const { fn } = fakeFetch(() => new Response('', { status: 503 }))
    const error = await createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn }).collection('notes').find().catch(e => e)
    expect(error).toMatchObject({ status: 503, message: 'Request failed (503)' })
  })
})

describe('collections', () => {
  const doc = { id: 1, title: 'Hello' }

  it('asks for unpopulated relationships and encodes the query', async () => {
    const { fn, calls } = fakeFetch(() => json({ docs: [doc], totalDocs: 1 }))
    await createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn }).collection('notes').find({ where: { title: { equals: 'Hi' } }, limit: 5 })
    expect(calls[0].url).toBe('/api/notes?depth=0&where[title][equals]=Hi&limit=5')
  })

  it('creates, updates and removes', async () => {
    const { fn, calls } = fakeFetch(({ init }) => init.method === 'DELETE' ? json({}) : json({ doc }))
    const notes = createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn }).collection<typeof doc>('notes')

    expect(await notes.create({ title: 'Hello' })).toEqual(doc)
    expect(await notes.update(1, { title: 'Hello' })).toEqual(doc)
    await notes.remove(1)

    expect(calls.map(call => `${call.init.method} ${call.url}`)).toEqual([
      'POST /api/notes?depth=0',
      'PATCH /api/notes/1?depth=0',
      'DELETE /api/notes/1',
    ])
  })

  it('creates idempotently through the dedicated route and returns the stored document', async () => {
    const { fn, calls } = fakeFetch(() => json({ doc, created: false }))
    const result = await createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn }).collection<typeof doc>('notes').createIdempotent({ title: 'Hello', clientMutationId: 'op-1' })

    expect(result).toEqual(doc)
    expect(calls[0].url).toBe('/api/notes/idempotent')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ title: 'Hello', clientMutationId: 'op-1' })
  })
})

describe('actions and account', () => {
  it('sends an Idempotency-Key and reuses the key it is given', async () => {
    const { fn, calls } = fakeFetch(() => json({ ok: true }))
    const client = createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn })

    await client.action('/actions/duplicate-note', { id: 1 }, 'retry-1')
    await client.action('/actions/duplicate-note', { id: 1 }, 'retry-1')
    await client.action('/actions/duplicate-note', { id: 1 })

    expect(calls[0].init.headers['Idempotency-Key']).toBe('retry-1')
    expect(calls[1].init.headers['Idempotency-Key']).toBe('retry-1')
    expect(calls[2].init.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('says whether an email sign-up still needs verification', async () => {
    const needs = fakeFetch(() => json({ token: null, user: rawUser }))
    const done = fakeFetch(() => json({ token: 'abc', user: rawUser }))
    const input = { email: 'a@example.com', password: 'a-long-enough-password', name: 'Ada' }

    expect(await createApiClient({ baseUrl: '', mode: 'cookie', fetch: needs.fn }).auth.signUpWithEmail(input)).toEqual({ needsVerification: true })
    expect(await createApiClient({ baseUrl: '', mode: 'cookie', fetch: done.fn }).auth.signUpWithEmail(input)).toEqual({ needsVerification: false })
  })

  it('sends the native ID token in the shape Better Auth expects', async () => {
    const { fn, calls } = fakeFetch(() => json({ user: rawUser }))
    await createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn }).auth.signInWithIdToken({ provider: 'apple', token: 'jwt', nonce: 'n' })
    expect(calls[0].url).toBe('/api/auth/sign-in/social')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ provider: 'apple', idToken: { token: 'jwt', nonce: 'n' } })
  })

  it('uses the current Better Auth password reset routes', async () => {
    const { fn, calls } = fakeFetch(() => json({}))
    const client = createApiClient({ baseUrl: '', mode: 'cookie', fetch: fn })
    await client.auth.requestPasswordReset('a@example.com', 'https://app.example.com/reset')
    await client.auth.resetPassword('tok', 'a-new-long-password')
    expect(calls.map(call => call.url)).toEqual(['/api/auth/request-password-reset', '/api/auth/reset-password'])
  })
})
