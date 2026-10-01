import {
  authentication,
  type AuthenticationClient,
  type AuthenticationMode,
  type AuthenticationStorage,
  createDirectus,
  type DirectusClient,
  rest,
  type RestClient,
} from '@directus/sdk'

export interface CreateDirectusClientOptions {
  url: string
  /**
   * `session` (default) uses HTTP-only cookies and suits browsers on the same site.
   * `json` keeps tokens in `storage` and is required inside Capacitor shells,
   * where cookies for a remote API are unreliable.
   */
  mode?: AuthenticationMode
  credentials?: RequestCredentials
  /** Token storage for `json` mode. Defaults to the SDK's in-memory storage. */
  storage?: AuthenticationStorage
}

export type LdDirectusClient<TSchema extends object> =
  DirectusClient<TSchema> & AuthenticationClient<TSchema> & RestClient<TSchema>

export function createDirectusClient<TSchema extends object>(
  options: CreateDirectusClientOptions,
): LdDirectusClient<TSchema> {
  const mode = options.mode ?? 'session'
  const credentials = options.credentials ?? (mode === 'session' ? 'include' : 'omit')

  return createDirectus<TSchema>(options.url)
    .with(authentication(mode, { credentials, storage: options.storage }))
    .with(rest({ credentials }))
}
