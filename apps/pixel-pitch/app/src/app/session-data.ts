import { scopeStorageKey } from '@ld/offline'
import { appConfig } from '@/config/app.config'
import { offlineStorage } from '@/lib/platform/storage'

/**
 * Removes the cached screens this device holds for one user. Called when an account is deleted. Signing out keeps
 * them, so the same person sees their club straight away when they return.
 */
export async function clearUserData(userId: string) {
  await offlineStorage.remove(scopeStorageKey('query-cache', appConfig.projectId, userId))
}
