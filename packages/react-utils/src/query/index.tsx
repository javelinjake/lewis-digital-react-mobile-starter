import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import type { ReactNode } from 'react'
import type { AsyncStorage, Outbox, OutboxSnapshot } from '@ld/offline'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useSyncExternalStore } from 'react'

export const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24
export const QUERY_CACHE_BUSTER = 'ld-query-v1'

/** Outbox mutations must run while offline so the write reaches the outbox. */
export const outboxMutationDefaults = {
  networkMode: 'always' as const,
  retry: false as const,
}

export const persistDehydrateOptions = {
  shouldDehydrateMutation: () => false,
}

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: QUERY_CACHE_MAX_AGE,
        networkMode: 'offlineFirst',
        retry: 1,
      },
      mutations: {
        networkMode: 'always',
        retry: false,
      },
    },
  })
}

export function createIdbQueryPersister(storage: AsyncStorage, key: string): Persister {
  return {
    persistClient: async (client) => {
      await storage.set(key, client)
    },
    restoreClient: async () => storage.get<PersistedClient>(key),
    removeClient: async () => {
      await storage.remove(key)
    },
  }
}

const emptySnapshot: OutboxSnapshot = { items: [], isFlushing: false }

export function useOutboxSnapshot(outbox: Outbox | null) {
  return useSyncExternalStore(
    listener => outbox ? outbox.subscribe(listener) : () => {},
    () => outbox ? outbox.getSnapshot() : emptySnapshot,
    () => emptySnapshot,
  )
}

export function PersistedQueryProvider({
  client,
  persister,
  buster = QUERY_CACHE_BUSTER,
  onRestored,
  children,
}: {
  client: QueryClient
  persister: Persister
  buster?: string
  onRestored?: () => void
  children: ReactNode
}) {
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: QUERY_CACHE_MAX_AGE,
        buster,
        dehydrateOptions: persistDehydrateOptions,
      }}
      onSuccess={onRestored}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
