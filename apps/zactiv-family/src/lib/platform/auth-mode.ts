import type { AuthenticationMode } from '@directus/sdk'
import { isNativePlatform } from '@ld/native'

/**
 * Session cookies are not sent from another site (localhost, Capacitor) to Directus.
 * Those clients use JSON tokens: a first-party cookie on the web, the keychain natively.
 */
export function getAuthMode(): AuthenticationMode {
  if (isNativePlatform() || import.meta.env.VITE_BUILD_TARGET === 'native')
    return 'json'

  if (typeof window === 'undefined')
    return 'json'

  const apiUrl = import.meta.env.VITE_DIRECTUS_URL
  if (!apiUrl)
    return 'json'

  try {
    return new URL(apiUrl).origin === window.location.origin ? 'session' : 'json'
  }
  catch {
    return 'json'
  }
}

export function getAuthRequestOptions() {
  return { mode: getAuthMode() }
}
