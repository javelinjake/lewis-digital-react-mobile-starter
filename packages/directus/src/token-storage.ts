import type { AuthenticationData, AuthenticationStorage } from '@directus/sdk'

export interface StringStorage {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  remove: (key: string) => Promise<void>
}

/**
 * Adapts any string key/value store (Capacitor Preferences, localStorage, secure storage)
 * into the Directus SDK's `AuthenticationStorage` for `json` mode.
 */
export function createTokenStorage(storage: StringStorage, key = 'directus-auth'): AuthenticationStorage {
  return {
    async get() {
      const raw = await storage.get(key)
      if (!raw)
        return null

      try {
        return JSON.parse(raw) as AuthenticationData
      }
      catch {
        await storage.remove(key)
        return null
      }
    },
    async set(value) {
      if (value === null || (!value.access_token && !value.refresh_token))
        await storage.remove(key)
      else
        await storage.set(key, JSON.stringify(value))
    },
  }
}

/** JSON auth mode options for login/refresh/logout calls. */
export const jsonAuthOptions = { mode: 'json' as const }
