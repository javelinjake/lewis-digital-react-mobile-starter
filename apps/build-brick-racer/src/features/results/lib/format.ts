import type { ChallengeDefinition } from '@/game/challenges/types'
import { formatMetric } from '@/game/comparison'

/** Times read like 00:21.8; every other metric uses the shared formatter. */
export function formatPrimary(def: ChallengeDefinition, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return 'Not measured'
  const id = def.metrics.primary
  if (id === 'time' || id === 'accelTime') {
    const minutes = Math.floor(value / 60)
    const seconds = value - minutes * 60
    return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`
  }
  return formatMetric(id, value)
}

export const assistLabel = (assist: 'off' | 'light'): string => (assist === 'light' ? 'Steering help on' : 'Steering help off')
