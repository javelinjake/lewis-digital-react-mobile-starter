import type { OutboxItem } from '@ld/offline'
import type { ReactNode } from 'react'
import type { Note } from '@/features/notes/types/note'
import { useNetworkStatus } from '@ld/native/react'
import { createOutbox, scopeStorageKey } from '@ld/offline'
import { createAppQueryClient, createIdbQueryPersister, PersistedQueryProvider } from '@ld/react-utils/query'
import { LoadingState } from '@ld/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { OutboxProvider } from '@/app/outbox-provider'
import { appConfig } from '@/config/app.config'
import { registerNotesOutboxHandlers } from '@/features/notes/api/register-outbox-handlers'
import { mergeNotes } from '@/features/notes/queries/merge-notes'
import { notesQueryKeys } from '@/features/notes/queries/notes.keys'
import { offlineStorage } from '@/lib/platform/storage'
import { useAuthStore } from '@/stores/auth.store'

export function SessionScope({ children }: { children: ReactNode }) {
  const status = useAuthStore(state => state.status)
  const userId = useAuthStore(state => state.userId)

  if (status === 'bootstrapping')
    return <LoadingState message="Restoring session..." />

  return <ScopedSession key={userId ?? 'anonymous'} userId={userId}>{children}</ScopedSession>
}

function ScopedSession({ userId, children }: { userId: string | null, children: ReactNode }) {
  const { isOnline } = useNetworkStatus()
  const onlineRef = useRef(isOnline)
  onlineRef.current = isOnline
  const [client] = useState(createAppQueryClient)
  const scope = userId ?? 'anonymous'

  const persister = useMemo(
    () => createIdbQueryPersister(offlineStorage, scopeStorageKey('query-cache', appConfig.projectId, scope)),
    [scope],
  )

  const outbox = useMemo(() => {
    if (!userId)
      return null

    return createOutbox({
      storage: offlineStorage,
      storageKey: scopeStorageKey('outbox', appConfig.projectId, userId),
      userId,
      projectId: appConfig.projectId,
      isOnline: () => onlineRef.current,
      onAuthHold: () => {
        void useAuthStore.getState().expireSession()
      },
    })
  }, [userId])

  useEffect(() => {
    if (!outbox)
      return

    registerNotesOutboxHandlers(outbox)
    const stopSynced = outbox.onSynced(() => {
      void client.invalidateQueries({ queryKey: notesQueryKeys.all })
    })
    let cancel = false

    void outbox.ready.then(async () => {
      if (cancel)
        return
      await outbox.releaseAuthHolds()
      restorePending(client, outbox.getItems())
      await outbox.flush()
    })

    if (import.meta.env.DEV) {
      window.__ldTest = {
        flush: () => outbox.flush(),
        pending: () => outbox.getItems().length,
      }
    }

    return () => {
      cancel = true
      stopSynced()
    }
  }, [client, outbox])

  const wasOnline = useRef(isOnline)
  useEffect(() => {
    if (isOnline && !wasOnline.current)
      void outbox?.flush()
    wasOnline.current = isOnline
  }, [isOnline, outbox])

  return (
    <OutboxProvider value={outbox}>
      <PersistedQueryProvider
        client={client}
        persister={persister}
        onRestored={() => {
          if (outbox)
            restorePending(client, outbox.getItems())
        }}
      >
        {children}
      </PersistedQueryProvider>
    </OutboxProvider>
  )
}

function restorePending(client: ReturnType<typeof createAppQueryClient>, items: OutboxItem[]) {
  if (items.length === 0)
    return

  const current = client.getQueryData<Note[]>(notesQueryKeys.list())
  client.setQueryData(notesQueryKeys.list(), mergeNotes(current, items))
}
