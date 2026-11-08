import type { ApiClient } from '@ld/api-client'
import { createApiClient } from '@ld/api-client'
import { isNativePlatform } from '@ld/native'
import { getEnvConfig } from '@/config/env.config'
import { credentialStorage } from '@/lib/platform/storage'

let client: ApiClient | null = null
let sessionLostHandler: () => void = () => {}

/** The auth store registers here, so a 401 on any data request ends the session. */
export function onSessionLost(handler: () => void) {
  sessionLostHandler = handler
}

/**
 * One client for the app. Web: the session cookie, calls go to `/api` on this origin. Native: the session token is
 * kept in the Keychain or Keystore and sent as a bearer token to the absolute API address.
 */
export function getApi(): ApiClient {
  if (!client) {
    const native = isNativePlatform()
    client = createApiClient({
      baseUrl: getEnvConfig().VITE_API_URL,
      mode: native ? 'token' : 'cookie',
      tokenStorage: native ? credentialStorage : undefined,
      onUnauthorized: () => sessionLostHandler(),
    })
  }

  return client
}
