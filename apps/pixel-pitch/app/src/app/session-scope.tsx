import type { ReactNode } from 'react'
import { scopeStorageKey } from '@ld/offline'
import { createAppQueryClient, createIdbQueryPersister, PersistedQueryProvider } from '@ld/react-utils/query'
import { LoadingState } from '@ld/ui'
import { useMemo, useState } from 'react'
import { appConfig } from '@/config/app.config'
import { offlineStorage } from '@/lib/platform/storage'
import { useAuthStore } from '@/stores/auth.store'

/**
 * One query cache per signed-in person, persisted on the device, so the club hub opens instantly with the last known
 * state while a sync runs. The game is online-only: every change goes straight to the server (there is no outbox).
 */
export function SessionScope({ children }: { children: ReactNode }) {
  const status = useAuthStore(state => state.status)
  const userId = useAuthStore(state => state.userId)

  if (status === 'bootstrapping')
    return <LoadingState message="Restoring session..." />

  return <ScopedSession key={userId ?? 'anonymous'} userId={userId}>{children}</ScopedSession>
}

function ScopedSession({ userId, children }: { userId: string | null, children: ReactNode }) {
  const [client] = useState(createAppQueryClient)
  const scope = userId ?? 'anonymous'
  const persister = useMemo(
    () => createIdbQueryPersister(offlineStorage, scopeStorageKey('query-cache', appConfig.projectId, scope)),
    [scope],
  )

  return (
    <PersistedQueryProvider client={client} persister={persister}>
      {children}
    </PersistedQueryProvider>
  )
}
