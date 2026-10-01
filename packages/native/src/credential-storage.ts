import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { isNativePlatform } from './platform'

export interface CredentialStorage {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  remove: (key: string) => Promise<void>
  clear: () => Promise<void>
}

/**
 * Keychain / Keystore storage for auth tokens on native builds.
 * Web authentication uses HTTP-only session cookies and must not call this.
 */
export function createCredentialStorage(): CredentialStorage {
  function assertNative() {
    if (!isNativePlatform())
      throw new Error('Credential storage is native-only. Web auth uses session cookies.')
  }

  return {
    async get(name) {
      assertNative()
      const value = await SecureStorage.get(name)
      if (typeof value === 'string')
        return value
      if (value == null)
        return null
      return JSON.stringify(value)
    },
    async set(name, value) {
      assertNative()
      await SecureStorage.set(name, value)
    },
    async remove(name) {
      assertNative()
      await SecureStorage.remove(name)
    },
    async clear() {
      assertNative()
      await SecureStorage.clear()
    },
  }
}
