import { Preferences } from '@capacitor/preferences'

export interface KeyValueStorage {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  remove: (key: string) => Promise<void>
  clear: () => Promise<void>
}

/**
 * Non-secret preferences (theme, last profile, flags).
 * UserDefaults / SharedPreferences natively, localStorage in the browser.
 * Do not store credentials here — use `createCredentialStorage`.
 */
export function createKeyValueStorage(prefix = 'ld'): KeyValueStorage {
  const key = (name: string) => `${prefix}:${name}`

  return {
    async get(name) {
      const { value } = await Preferences.get({ key: key(name) })
      return value
    },
    async set(name, value) {
      await Preferences.set({ key: key(name), value })
    },
    async remove(name) {
      await Preferences.remove({ key: key(name) })
    },
    async clear() {
      const { keys } = await Preferences.keys()
      await Promise.all(
        keys.filter(item => item.startsWith(`${prefix}:`)).map(item => Preferences.remove({ key: item })),
      )
    },
  }
}
