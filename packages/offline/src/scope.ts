export const OUTBOX_STORAGE_VERSION = 1
export const QUERY_CACHE_STORAGE_VERSION = 1

export type ScopedStore = 'outbox' | 'query-cache'

/** Durable key scoped to one API project and one user. Never share across accounts. */
export function scopeStorageKey(store: ScopedStore, projectId: string, userId: string) {
  const version = store === 'outbox' ? OUTBOX_STORAGE_VERSION : QUERY_CACHE_STORAGE_VERSION
  return `ld:${store}:v${version}:${projectId}:${userId}`
}
