import type { ConnectionType } from './network'
import { Network } from '@capacitor/network'
import { useSyncExternalStore } from 'react'
import { createSharedSubscription } from './shared-subscription'

interface NetworkSnapshot {
  isOnline: boolean
  connectionType: ConnectionType
}

let snapshot: NetworkSnapshot = {
  isOnline: true,
  connectionType: 'unknown',
}

const listeners = new Set<() => void>()

function publish(next: NetworkSnapshot) {
  snapshot = next
  listeners.forEach(listener => listener())
}

const subscription = createSharedSubscription(async () => {
  const status = await Network.getStatus()
  publish({
    isOnline: status.connected,
    connectionType: status.connectionType,
  })

  const handle = await Network.addListener('networkStatusChange', (next) => {
    publish({
      isOnline: next.connected,
      connectionType: next.connectionType,
    })
  })

  return () => handle.remove()
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  const release = subscription.subscribe()
  return () => {
    listeners.delete(listener)
    release()
  }
}

export function useNetworkStatus() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}
