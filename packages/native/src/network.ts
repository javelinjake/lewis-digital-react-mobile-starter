import { Network } from '@capacitor/network'

export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown'

/** One-shot connectivity read for startup. UI should use `useNetworkStatus`. */
export async function readOnlineHint(): Promise<boolean> {
  try {
    const status = await Network.getStatus()
    return status.connected
  }
  catch {
    return true
  }
}
