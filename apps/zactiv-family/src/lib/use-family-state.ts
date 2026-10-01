import type { FamilyState } from '@/lib/family-data'
import { useSyncExternalStore } from 'react'
import { readFamilyState, subscribeFamilyState, updateFamilyState } from '@/lib/family-data'
import { useAuthStore } from '@/stores/auth.store'

export function useFamilyState() {
  const userId = useAuthStore(state => state.user?.id) ?? 'anonymous'
  const snapshot = useSyncExternalStore(
    listener => subscribeFamilyState(userId, listener),
    () => readFamilyState(userId),
    () => readFamilyState(userId),
  )

  return {
    state: snapshot,
    update: (patch: (current: FamilyState) => FamilyState) => updateFamilyState(userId, patch),
  }
}
