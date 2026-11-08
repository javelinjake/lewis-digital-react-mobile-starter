import { useNetworkStatus } from '@ld/native/react'

/** The game needs the server for every change. Offline, screens show the last known club read-only. */
export function useConnectivity() {
  const { isOnline } = useNetworkStatus()
  return { offline: !isOnline }
}
