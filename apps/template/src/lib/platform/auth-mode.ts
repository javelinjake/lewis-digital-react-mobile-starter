import type { AuthenticationMode } from '@directus/sdk'
import { isNativePlatform } from '@ld/native'

/** Cookies on the web. JSON tokens in the credential store inside Capacitor. */
export function getAuthMode(): AuthenticationMode {
  return isNativePlatform() ? 'json' : 'session'
}

export const authRequestOptions = { mode: getAuthMode() }
