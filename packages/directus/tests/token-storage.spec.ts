import type { StringStorage } from '../src/token-storage'
import { describe, expect, it } from 'vitest'
import { createTokenStorage } from '../src/token-storage'

function createMemoryStringStorage(): StringStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()

  return {
    map,
    get: async key => map.get(key) ?? null,
    set: async (key, value) => {
      map.set(key, value)
    },
    remove: async (key) => {
      map.delete(key)
    },
  }
}

describe('createTokenStorage', () => {
  it('round-trips authentication data', async () => {
    const backing = createMemoryStringStorage()
    const storage = createTokenStorage(backing)

    const data = { access_token: 'a', refresh_token: 'r', expires: 900, expires_at: 123 }
    await storage.set(data)

    expect(await storage.get()).toEqual(data)
  })

  it('removes the entry when tokens are cleared', async () => {
    const backing = createMemoryStringStorage()
    const storage = createTokenStorage(backing)

    await storage.set({ access_token: 'a', refresh_token: 'r', expires: 900, expires_at: 123 })
    await storage.set(null)

    expect(backing.map.size).toBe(0)
    expect(await storage.get()).toBeNull()
  })

  it('discards corrupt values', async () => {
    const backing = createMemoryStringStorage()
    backing.map.set('directus-auth', '{not json')

    const storage = createTokenStorage(backing)
    expect(await storage.get()).toBeNull()
    expect(backing.map.size).toBe(0)
  })
})
