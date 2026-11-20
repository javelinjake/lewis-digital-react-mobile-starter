import { scopeStorageKey } from '@ld/offline'
import { appConfig } from '@/config/app.config'
import { offlineStorage } from '@/lib/platform/storage'

/**
 * Removes everything this device holds for one user: the cached screens and any writes still waiting to be sent.
 * Called when an account is deleted. Signing out keeps both, so the same person finds their work when they return.
 */
export async function clearUserData(userId: string) {
  await Promise.all([
    offlineStorage.remove(scopeStorageKey('query-cache', appConfig.projectId, userId)),
    offlineStorage.remove(scopeStorageKey('outbox', appConfig.projectId, userId)),
  ])
}
