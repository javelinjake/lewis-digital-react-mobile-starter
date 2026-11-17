import type { EnvironmentDefinition, EnvironmentId } from '../env/types'
import type { ChallengeDefinition, ChallengeId } from './types'
import { garden } from '../env/garden'
import { kitchen } from '../env/kitchen'
import { gardenClimb, gardenJump, gardenMud } from './garden'
import { kitchenAcceleration, kitchenBraking, kitchenCoast, kitchenDrift, kitchenSprint } from './kitchen'

export const CHALLENGES: Record<ChallengeId, ChallengeDefinition> = {
  kitchen_sprint: kitchenSprint,
  kitchen_acceleration: kitchenAcceleration,
  kitchen_braking: kitchenBraking,
  kitchen_drift: kitchenDrift,
  kitchen_coast: kitchenCoast,
  garden_mud: gardenMud,
  garden_climb: gardenClimb,
  garden_jump: gardenJump,
}

export const ENVIRONMENTS: Record<EnvironmentId, EnvironmentDefinition> = { kitchen, garden }

export const getChallenge = (id: string): ChallengeDefinition | undefined => (CHALLENGES as Record<string, ChallengeDefinition>)[id]

export function challengesIn(place: EnvironmentId): ChallengeDefinition[] {
  return Object.values(CHALLENGES).filter(c => c.environment === place)
}

/** Open-floor free drive spawn for each place. */
export const FREE_DRIVE: Record<EnvironmentId, { position: [number, number, number], yaw: number }> = {
  kitchen: { position: [-4, 0, 40], yaw: 0 },
  garden: { position: [0, 0, 80], yaw: 0 },
}
