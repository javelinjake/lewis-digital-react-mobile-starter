import type { ApiClientOptions, FindParams, FindResult, SessionUser, SocialProvider } from './types'
import { ApiError, messageFromBody } from './errors'
import { toQueryString } from './query'

const DEFAULT_TOKEN_KEY = 'session-token'

interface RawUser {
  id: string | number
  email?: string
  name?: string | null
  image?: string | null
  role?: string
  isAnonymous?: boolean
  emailVerified?: boolean
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, never> | string
  headers?: Record<string, string>
  /** A data request. A 401 here means the session is gone, so `onUnauthorized` runs. Sign-in failures also 401, so they do not use it. */
  authenticated?: boolean
}

function normalizeUser(raw: RawUser): SessionUser {
  return {
    id: String(raw.id),
    email: raw.email ?? '',
    name: raw.name ?? null,
    image: raw.image ?? null,
    role: raw.role === 'admin' ? 'admin' : 'member',
    isAnonymous: Boolean(raw.isAnonymous),
    emailVerified: Boolean(raw.emailVerified),
  }
}

export function newIdempotencyKey() {
  return globalThis.crypto.randomUUID()
}

/**
 * Talks to one app's backend: Better Auth for sign-in, Payload's REST API for data.
 *
 * Web uses the session cookie. Native keeps the session token in the Keychain or Keystore and sends it as a bearer
 * token. Either way, "who am I" comes from Better Auth's `get-session`, never Payload's `/users/me`, which cannot
 * read a bearer token.
 */
export function createApiClient(options: ApiClientOptions) {
  const tokenKey = options.tokenKey ?? DEFAULT_TOKEN_KEY
  const useToken = options.mode === 'token'
  let cachedToken: string | null | undefined

  async function readToken() {
    if (!useToken || !options.tokenStorage)
      return null
    if (cachedToken === undefined)
      cachedToken = await options.tokenStorage.get(tokenKey)
    return cachedToken
  }

  async function writeToken(token: string | null) {
    if (!useToken || !options.tokenStorage)
      return
    cachedToken = token
    if (token)
      await options.tokenStorage.set(tokenKey, token)
    else
      await options.tokenStorage.remove(tokenKey)
  }

  async function send<T>(path: string, request: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...request.headers }
    if (request.body !== undefined)
      headers['Content-Type'] = 'application/json'

    const token = await readToken()
    if (token)
      headers.Authorization = `Bearer ${token}`

    const query = typeof request.query === 'string' && request.query ? `?${request.query}` : ''
    const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)

    // A network failure throws a TypeError. It is left alone on purpose: the outbox reads it as "offline, retry".
    const response = await doFetch(`${options.baseUrl}${path}${query}`, {
      method: request.method ?? 'GET',
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      credentials: useToken ? 'omit' : 'include',
    })

    const issued = response.headers.get('set-auth-token')
    if (issued)
      await writeToken(issued)

    const text = await response.text()
    let body: unknown
    try {
      body = text ? JSON.parse(text) : undefined
    }
    catch {
      body = text
    }

    if (!response.ok) {
      if (response.status === 401 && request.authenticated)
        options.onUnauthorized?.()
      throw new ApiError(response.status, messageFromBody(body, `Request failed (${response.status})`), body)
    }

    return body as T
  }

  const auth = {
    /** The current person, or null when nobody is signed in. */
    async getSession(): Promise<SessionUser | null> {
      const body = await send<{ user?: RawUser } | null>('/api/auth/get-session')
      return body?.user ? normalizeUser(body.user) : null
    },

    async signInAnonymously(): Promise<SessionUser> {
      const body = await send<{ user: RawUser }>('/api/auth/sign-in/anonymous', { method: 'POST', body: {} })
      return normalizeUser(body.user)
    },

    async signInWithEmail(email: string, password: string): Promise<SessionUser> {
      const body = await send<{ user: RawUser }>('/api/auth/sign-in/email', { method: 'POST', body: { email, password } })
      return normalizeUser(body.user)
    },

    /**
     * Sends a confirmation email. Nobody is signed in until the link is opened, then they sign in as usual. When the
     * device still holds a guest session, that sign-in carries the guest's data into the account.
     */
    async signUpWithEmail(input: { email: string, password: string, name: string, callbackURL?: string }) {
      const body = await send<{ token: string | null }>('/api/auth/sign-up/email', { method: 'POST', body: input })
      return { needsVerification: !body?.token }
    },

    /** Native Apple and Google sign-in hand back an ID token. The backend verifies it. */
    async signInWithIdToken(input: { provider: SocialProvider, token: string, nonce?: string }): Promise<SessionUser> {
      const body = await send<{ user: RawUser }>('/api/auth/sign-in/social', {
        method: 'POST',
        body: { provider: input.provider, idToken: { token: input.token, nonce: input.nonce } },
      })
      return normalizeUser(body.user)
    },

    async resendVerification(email: string, callbackURL?: string) {
      await send('/api/auth/send-verification-email', { method: 'POST', body: { email, callbackURL } })
    },

    async requestPasswordReset(email: string, redirectTo?: string) {
      await send('/api/auth/request-password-reset', { method: 'POST', body: { email, redirectTo } })
    },

    async resetPassword(token: string, newPassword: string) {
      await send('/api/auth/reset-password', { method: 'POST', body: { token, newPassword } })
    },

    /** Ends the session on the server and forgets the token. The token is forgotten even if the server is unreachable. */
    async signOut() {
      try {
        await send('/api/auth/sign-out', { method: 'POST', body: {} })
      }
      finally {
        await writeToken(null)
      }
    },

    /** Deletes the account and everything it owns. Required by the App Store. */
    async deleteAccount() {
      await send('/api/account', { method: 'DELETE', authenticated: true })
      await writeToken(null)
    },

    /** Everything the app holds about the person, as JSON. */
    exportAccount() {
      return send<unknown>('/api/account/export', { authenticated: true })
    },
  }

  /** Typed access to one Payload collection. Every call asks for `depth=0`, so relationships come back as ids. */
  function collection<T extends { id: number | string }>(slug: string) {
    const base = `/api/${slug}`
    const queryOf = (params: FindParams = {}) => toQueryString({ depth: 0, ...params } as never)

    return {
      find: (params?: FindParams) => send<FindResult<T>>(base, { query: queryOf(params), authenticated: true }),

      async findById(id: number | string) {
        return send<T>(`${base}/${id}`, { query: queryOf(), authenticated: true })
      },

      async create(data: Record<string, unknown>) {
        const body = await send<{ doc: T }>(base, { method: 'POST', body: data, query: queryOf(), authenticated: true })
        return body.doc
      },

      /**
       * Creates the document unless one with the same `clientMutationId` already exists, in which case that one comes
       * back. Safe to retry after a dropped connection, so the outbox uses this.
       */
      async createIdempotent(data: Record<string, unknown> & { clientMutationId: string }) {
        const body = await send<{ doc: T, created: boolean }>(`${base}/idempotent`, { method: 'POST', body: data, authenticated: true })
        return body.doc
      },

      async update(id: number | string, data: Record<string, unknown>) {
        const body = await send<{ doc: T }>(`${base}/${id}`, { method: 'PATCH', body: data, query: queryOf(), authenticated: true })
        return body.doc
      },

      async remove(id: number | string) {
        await send(`${base}/${id}`, { method: 'DELETE', authenticated: true })
      },
    }
  }

  /**
   * Calls a server action (`defineAction` on the backend). The server decides the outcome. Pass the same key when
   * retrying the same request, and the first result is returned instead of a second grant.
   */
  function action<T>(path: string, body: Record<string, unknown> = {}, idempotencyKey: string = newIdempotencyKey()) {
    return send<T>(`/api${path}`, { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey }, authenticated: true })
  }

  return { auth, collection, action, request: send }
}

export type ApiClient = ReturnType<typeof createApiClient>
