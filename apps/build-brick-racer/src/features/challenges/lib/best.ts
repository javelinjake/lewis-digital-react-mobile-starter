import type { ChallengeDefinition } from '@/game/challenges/types'
import type { ProgressRecord } from '@/game/persistence/types'
import type { AssistMode } from '@/game/vehicle/physics-config'
import { formatMetric, settingsSignature } from '@/game/comparison'
import { PHYSICS_VERSION, SURFACE_SIGNATURE } from '@/game/vehicle/physics-config'

/** The signature a run of this challenge would get right now with the given steering help. */
export function currentSignature(def: ChallengeDefinition, assist: AssistMode): string {
  return settingsSignature({
    challengeId: def.id,
    challengeVersion: def.version,
    physicsVersion: PHYSICS_VERSION,
    surfaceSignature: SURFACE_SIGNATURE,
    powerMode: def.powerMode,
    assist,
  })
}

/** Personal-best record for the CURRENT settings, so a best set with different help never shows here. */
export function progressFor(def: ChallengeDefinition, assist: AssistMode, all: readonly ProgressRecord[]): ProgressRecord | undefined {
  const signature = currentSignature(def, assist)
  return all.find(p => p.signature === signature)
}

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

export type Award = 'none' | 'finished' | 'great'

export function awardOf(progress: ProgressRecord | undefined): Award {
  if (!progress?.completed)
    return 'none'
  return progress.great ? 'great' : 'finished'
}
