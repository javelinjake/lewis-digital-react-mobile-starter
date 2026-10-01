import { createStore, del, get, keys, set } from 'idb-keyval'

/** Minimal async key/value contract so tests and native adapters can swap implementations. */
export interface AsyncStorage {
  get: <T = unknown>(key: string) => Promise<T | undefined>
  set: (key: string, value: unknown) => Promise<void>
  remove: (key: string) => Promise<void>
  keys: () => Promise<string[]>
}

/**
 * IndexedDB storage (structured clone, no JSON size limits) with a memory
 * fallback for environments without IndexedDB.
 */
export function createIdbStorage(dbName = 'ld-offline', storeName = 'kv'): AsyncStorage {
  if (typeof indexedDB === 'undefined')
    return createMemoryStorage()

  const store = createStore(dbName, storeName)

  return {
    get: key => get(key, store),
    set: (key, value) => set(key, value, store),
    remove: key => del(key, store),
    keys: async () => (await keys(store)).map(String),
  }
}

export function createMemoryStorage(): AsyncStorage {
  const map = new Map<string, unknown>()

  return {
    get: async <T>(key: string) => map.get(key) as T | undefined,
    set: async (key, value) => {
      map.set(key, value)
    },
    remove: async (key) => {
      map.delete(key)
    },
    keys: async () => [...map.keys()],
  }
}
