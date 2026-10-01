import type { ActivityStatus } from '@/lib/activity-log'
import { useQuery } from '@tanstack/react-query'
import { getActivityStatus } from '@/lib/activity-log'
import { useAuthStore } from '@/stores/auth.store'

export const activityKeys = {
  item: (itemType: 'workout' | 'recipe' | 'video', itemId: number) =>
    ['activity-status', itemType, itemId] as const,
  list: (itemType: 'workout' | 'recipe' | 'video', ids: number[]) =>
    ['activity-status', itemType, 'list', ...ids] as const,
}

export function useActivityStatusQuery(
  itemType: 'workout' | 'recipe' | 'video',
  itemId: number | undefined,
) {
  const userId = useAuthStore(state => state.user?.id)

  return useQuery({
    queryKey: activityKeys.item(itemType, itemId ?? 0),
    queryFn: () => getActivityStatus(itemType, itemId!),
    enabled: Boolean(userId && itemId),
  })
}

export function useActivityStatusMapQuery(
  itemType: 'workout' | 'recipe' | 'video',
  itemIds: number[],
) {
  const userId = useAuthStore(state => state.user?.id)
  const stableIds = [...itemIds].sort((a, b) => a - b)

  return useQuery({
    queryKey: activityKeys.list(itemType, stableIds),
    queryFn: async () => {
      const entries = await Promise.all(
        stableIds.map(async (id) => {
          const status = await getActivityStatus(itemType, id)
          return [id, status] as const
        }),
      )
      return Object.fromEntries(entries) as Record<number, ActivityStatus>
    },
    enabled: Boolean(userId && stableIds.length > 0),
  })
}
