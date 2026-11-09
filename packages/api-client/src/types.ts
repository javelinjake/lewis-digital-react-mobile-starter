import type { QueryValue } from './query'

/** Where the session token lives in token mode. Pass the native credential store (Keychain or Keystore). */
export interface TokenStorage {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  remove: (key: string) => Promise<void>
}

export interface ApiClientOptions {
  /**
   * Where the API is. Empty on the web: requests go to the same origin under `/api`, which Vercel (or the Vite dev
   * server) forwards to the backend, so the session cookie is first-party. Absolute on native.
   */
  baseUrl: string
  /** `cookie` on the web, `token` inside Capacitor (the session token is kept in `tokenStorage`). */
  mode: 'cookie' | 'token'
  tokenStorage?: TokenStorage
  /** Key under which the token is stored. */
  tokenKey?: string
  fetch?: typeof fetch
  /** Called when an authenticated request comes back 401, so the app can drop its session. */
  onUnauthorized?: () => void
}

/** The signed-in person, as Better Auth reports them. Note `id` is a string here even though Payload's ids are numbers. */
export interface SessionUser {
  id: string
  email: string
  name: string | null
  image: string | null
  role: 'admin' | 'member'
  isAnonymous: boolean
  emailVerified: boolean
}

export interface FindParams {
  where?: Record<string, QueryValue>
  limit?: number
  page?: number
  sort?: string
  depth?: number
}

export interface FindResult<T> {
  docs: T[]
  totalDocs: number
  limit: number
  page: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export type SocialProvider = 'apple' | 'google'
