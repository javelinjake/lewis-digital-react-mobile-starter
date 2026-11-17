import type { DriveAssessment } from '@/game/vehicle/analysis'
import type { ChallengeDefinition } from '@/game/challenges/types'
import { fitsSpawn } from '@/game/challenges/spawn'

export type ReadyState =
  | { kind: 'ok' }
  | { kind: 'too_big', reason: string }
  | { kind: 'blocked', reason: string, instanceIds: string[] }

/**
 * Whether the car can start this challenge. A free drive always has open ground. A concrete simulation
 * problem names its cause; a car too large for the start area offers free drive instead of being changed.
 */
export function readyState(def: ChallengeDefinition | null, assessment: DriveAssessment | null): ReadyState {
  if (!assessment)
    return { kind: 'ok' }
  const block = assessment.blocks[0]
  if (block)
    return { kind: 'blocked', reason: block.message, instanceIds: block.instanceIds }
  if (def && assessment.spec) {
    const fit = fitsSpawn(def, assessment.spec)
    if (!fit.fits)
      return { kind: 'too_big', reason: fit.reason ?? 'This car is too big for the start area.' }
  }
  return { kind: 'ok' }
}

export const powerLabel = (def: ChallengeDefinition | null): string => (def && def.powerMode === 'gravity' ? 'Gravity — motor off' : 'Motor on')
