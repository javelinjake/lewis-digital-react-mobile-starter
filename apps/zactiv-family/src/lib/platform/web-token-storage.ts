import type { AuthenticationData, AuthenticationStorage } from '@directus/sdk'

const DATA_COOKIE = 'directus-data'

function readCookie(name: string) {
  if (typeof document === 'undefined')
    return null

  const row = document.cookie.split('; ').find(item => item.startsWith(`${name}=`))
  if (!row)
    return null

  return decodeURIComponent(row.slice(name.length + 1))
}

function writeCookie(name: string, value: string | null) {
  if (typeof document === 'undefined')
    return

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const base = `${name}=${value == null ? '' : encodeURIComponent(value)}; Path=/; SameSite=Lax`
  document.cookie = value == null
    ? `${base}; Max-Age=0${secure}`
    : `${base}${secure}`
}

/** First-party cookie for JSON tokens. Not sent to Directus; the SDK sends Authorization. */
export function createWebTokenStorage(): AuthenticationStorage {
  return {
    get() {
      const raw = readCookie(DATA_COOKIE)
      if (!raw)
        return null

      try {
        return JSON.parse(raw) as AuthenticationData
      }
      catch {
        return null
      }
    },
    set(value) {
      if (value == null || (!value.access_token && !value.refresh_token))
        writeCookie(DATA_COOKIE, null)
      else
        writeCookie(DATA_COOKIE, JSON.stringify(value))
    },
  }
}

export function readWebAccessToken() {
  const stored = createWebTokenStorage().get()
  if (!stored || stored instanceof Promise)
    return null

  return stored.access_token ?? null
}
