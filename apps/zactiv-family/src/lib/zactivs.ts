import { useAuthStore } from '@/stores/auth.store'

export async function refreshBalance(expectedDelta?: number): Promise<number | null> {
  const previous = useAuthStore.getState().user?.balance ?? 0
  await useAuthStore.getState().refreshUser().catch(() => {})
  const next = useAuthStore.getState().user?.balance ?? 0

  if (expectedDelta !== undefined && expectedDelta > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zactivs-updated', {
      detail: { delta: expectedDelta, message: `+${expectedDelta} Zactivs!` },
    }))
  }
  else if (expectedDelta === undefined && next !== previous && typeof window !== 'undefined') {
    const delta = next - previous
    window.dispatchEvent(new CustomEvent('zactivs-updated', {
      detail: { delta, message: delta > 0 ? `+${delta} Zactivs!` : `${delta} Zactivs` },
    }))
  }

  return next
}
