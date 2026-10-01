import { useNetworkStatus } from '@ld/native/react'
import { useOutboxSnapshot } from '@ld/react-utils/query'
import { useOutbox } from '@/app/use-outbox'

export function useConnectivity() {
  const { isOnline } = useNetworkStatus()
  const outbox = useOutbox()
  const snapshot = useOutboxSnapshot(outbox)

  return {
    offline: !isOnline,
    pendingCount: snapshot.items.length,
    flush: () => outbox?.flush() ?? Promise.resolve(),
  }
}
