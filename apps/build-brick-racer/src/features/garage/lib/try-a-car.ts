import { useGarageStore } from '@/stores/garage.store'
import { usePrefsStore } from '@/stores/prefs.store'
import { useSessionStore } from '@/stores/session.store'

/**
 * "Try a car": the Racer goes straight into the Kitchen Ramp Run with steering help on. Uses an existing
 * Racer when there is one; otherwise creates it. Returns the car id, or null when it could not be saved.
 */
export async function prepareTryACar(): Promise<string | null> {
  const garage = useGarageStore.getState()
  const existing = garage.cars.find(c => c.starterId === 'racer')
  let carId = existing?.id ?? null
  if (!carId) {
    const doc = await garage.create('racer')
    carId = doc?.carId ?? null
  }
  else {
    garage.select(carId)
  }
  if (!carId)
    return null
  const prefs = usePrefsStore.getState().prefs
  const session = useSessionStore.getState()
  session.chooseCar(carId)
  session.choosePlace('kitchen')
  session.chooseChallenge('kitchen_sprint')
  session.setDriveOptions({ assist: 'light', camera: prefs.camera, cameraLock: prefs.cameraLock })
  session.setTrying(true)
  return carId
}
