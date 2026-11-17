import type { ChallengeDefinition } from '@/game/challenges/types'
import type { CarSnapshot, RunRecord } from '@/game/persistence/types'
import { defaultContext, duplicateCarDoc } from '@/game/build/doc'
import { getRepo } from '@/lib/platform/repo'
import { useGarageStore } from '@/stores/garage.store'
import { useSessionStore } from '@/stores/session.store'

/** Set up the session for another attempt of the same challenge with the same car and help. */
export function prepareDriveAgain(run: RunRecord, def: ChallengeDefinition): void {
  const s = useSessionStore.getState()
  s.chooseCar(run.carId)
  s.choosePlace(def.environment)
  s.chooseChallenge(def.id)
  s.setDriveOptions({ assist: run.assist, camera: run.camera })
  useGarageStore.getState().select(run.carId)
}

/**
 * The car to edit after a run. Normally the saved car with all its newer edits. If it was deleted from the
 * garage, a new car is made from the run's snapshot so nothing is lost.
 */
export async function carForEditing(run: RunRecord, carExists: boolean, snapshot: CarSnapshot | null): Promise<string | null> {
  if (carExists)
    return run.carId
  if (!snapshot)
    return null
  const copy = duplicateCarDoc(snapshot.doc, defaultContext, `${snapshot.doc.name} (restored)`)
  const saved = await getRepo().saveCar(copy)
  if (!saved.ok)
    return null
  await useGarageStore.getState().refresh()
  useGarageStore.getState().select(copy.carId)
  return copy.carId
}
