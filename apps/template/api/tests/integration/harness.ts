import type { Payload } from 'payload'
import config from '@payload-config'
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from '@payloadcms/next/routes'
import { getPayload } from 'payload'

const handlers = {
  GET: REST_GET(config),
  POST: REST_POST(config),
  PUT: REST_PUT(config),
  PATCH: REST_PATCH(config),
  DELETE: REST_DELETE(config),
  OPTIONS: REST_OPTIONS(config),
}

export const WEB_ORIGIN = 'http://localhost:5173'

export interface CallOptions {
  body?: unknown
  headers?: Record<string, string>
  origin?: string | null
}

export interface ApiResponse<T = any> {
  status: number
  headers: Headers
  json: T
}

export const ADMIN_EMAIL = 'admin@example.com'
export const ADMIN_PASSWORD = 'a-long-admin-password'

/**
 * Boots Payload against a freshly migrated database and creates the administrator first, the way
 * `cms:bootstrap-admin` does on deploy. The plugin makes the first account on an empty database an administrator,
 * so this must happen before any guest signs in.
 */
export async function boot(): Promise<Payload> {
  const payload = await getPayload({ config })
  await payload.db.migrateFresh({ forceAcceptWarning: true })

  const auth = (payload as unknown as { betterAuth: { api: { signUpEmail: (args: { body: Record<string, string> }) => Promise<{ user: { id: string } }> } } }).betterAuth
  const created = await auth.api.signUpEmail({ body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Administrator' } })
  await payload.update({ collection: 'users', id: Number(created.user.id), overrideAccess: true, data: { role: 'admin', emailVerified: true } })
  return payload
}

/** Calls a Payload REST route in-process with a real `Request`, the same path production takes. */
export async function call(method: keyof typeof handlers, path: string, options: CallOptions = {}): Promise<ApiResponse> {
  const url = new URL(path, 'http://localhost:3001')
  const headers = new Headers(options.headers)
  if (options.origin !== null)
    headers.set('Origin', options.origin ?? WEB_ORIGIN)
  if (options.body !== undefined && !headers.has('content-type'))
    headers.set('content-type', 'application/json')

  const request = new Request(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const slug = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean)
  const response = await handlers[method](request, { params: Promise.resolve({ slug }) })
  const text = await response.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : undefined
  }
  catch {
    json = text
  }
  return { status: response.status, headers: response.headers, json }
}

/** A signed-in browser or app: remembers cookies, or sends the bearer token like a native app does. */
export class Session {
  private cookies = new Map<string, string>()
  token?: string
  user?: { id: number, email: string }

  constructor(private mode: 'cookie' | 'bearer' = 'cookie') {}

  private absorb(response: ApiResponse) {
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const index = pair.indexOf('=')
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      if (value === '' || /max-age=0/i.test(line))
        this.cookies.delete(name)
      else
        this.cookies.set(name, value)
    }
    const token = response.headers.get('set-auth-token')
    if (token)
      this.token = token
  }

  private authHeaders(extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extra }
    if (this.mode === 'bearer' && this.token)
      headers.authorization = `Bearer ${this.token}`
    else if (this.cookies.size > 0)
      headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
    return headers
  }

  async request(method: keyof typeof handlers, path: string, options: CallOptions = {}) {
    const response = await call(method, path, { ...options, headers: this.authHeaders(options.headers) })
    this.absorb(response)
    return response
  }

  get = (path: string, options?: CallOptions) => this.request('GET', path, options)
  post = (path: string, body?: unknown, options?: CallOptions) => this.request('POST', path, { ...options, body })
  patch = (path: string, body?: unknown, options?: CallOptions) => this.request('PATCH', path, { ...options, body })
  delete = (path: string, options?: CallOptions) => this.request('DELETE', path, options)

  /** Guest sign-in, the first launch of an app that offers it. */
  async signInAnonymously() {
    const response = await this.post('/api/auth/sign-in/anonymous', {})
    if (response.status !== 200)
      throw new Error(`Anonymous sign-in failed: ${response.status} ${JSON.stringify(response.json)}`)
    // Better Auth's session endpoint works for cookies and bearer tokens. Payload's /users/me does not accept a
    // bearer token (it tries to decode it as a Payload JWT and returns 500), so apps must not call it either.
    const session = await this.get('/api/auth/get-session')
    // Better Auth ids are strings; Payload ids are numbers. Tests compare against Payload documents.
    this.user = session.json?.user && { ...session.json.user, id: Number(session.json.user.id) }
    return this
  }
}

export async function guest(mode: 'cookie' | 'bearer' = 'cookie') {
  return new Session(mode).signInAnonymously()
}

/**
 * A `fetch` that runs requests through the in-process Payload handlers, with its own cookie jar.
 * Lets the real `@ld/api-client` talk to the real backend without a network.
 */
export function inProcessFetch(jar = new Map<string, string>()): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input), 'http://localhost:3001')
    const headers = new Headers(init?.headers)
    if (jar.size > 0 && !headers.has('cookie') && !headers.has('authorization'))
      headers.set('cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '))

    const response = await call((init?.method ?? 'GET') as keyof typeof handlers, `${url.pathname}${url.search}`, {
      headers: Object.fromEntries(headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })

    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const index = pair.indexOf('=')
      const value = pair.slice(index + 1)
      if (value === '' || /max-age=0/i.test(line))
        jar.delete(pair.slice(0, index))
      else
        jar.set(pair.slice(0, index), value)
    }

    return new Response(response.json === undefined ? '' : JSON.stringify(response.json), { status: response.status, headers: response.headers })
  }
}
