import type { ChallengeId } from '@/game/challenges/types'
import type { EnvironmentId } from '@/game/env/types'
import type { CameraChoice, InterruptedAttempt } from '@/game/persistence/types'
import type { AssistMode } from '@/game/vehicle/physics-config'
import { create } from 'zustand'

/**
 * The flow between Garage, Challenge selection, Pre-run, Driving and Results. Returning to a challenge keeps
 * the last chosen route per place.
 */
interface SessionState {
  carId: string | null
  place: EnvironmentId
  /** Null means free drive. */
  challengeId: ChallengeId | null
  lastChallengeByPlace: Partial<Record<EnvironmentId, ChallengeId | null>>
  assist: AssistMode
  camera: CameraChoice
  cameraLock: boolean
  /** Result screen reads this. */
  lastRunId: string | null
  interrupted: InterruptedAttempt | null
  /** First-play shortcut: Try a car loads the racer straight into the Kitchen Ramp Run. */
  trying: boolean

  chooseCar: (id: string | null) => void
  choosePlace: (place: EnvironmentId) => void
  chooseChallenge: (id: ChallengeId | null) => void
  setDriveOptions: (patch: Partial<Pick<SessionState, 'assist' | 'camera' | 'cameraLock'>>) => void
  setLastRun: (id: string | null) => void
  setInterrupted: (info: InterruptedAttempt | null) => void
  setTrying: (trying: boolean) => void
}

export const useSessionStore = create<SessionState>(set => ({
  carId: null,
  place: 'kitchen',
  challengeId: null,
  lastChallengeByPlace: {},
  assist: 'light',
  camera: 'chase',
  cameraLock: false,
  lastRunId: null,
  interrupted: null,
  trying: false,

  chooseCar: carId => set({ carId }),
  choosePlace: place => set(s => ({ place, challengeId: s.lastChallengeByPlace[place] ?? null })),
  chooseChallenge: challengeId => set(s => ({ challengeId, lastChallengeByPlace: { ...s.lastChallengeByPlace, [s.place]: challengeId } })),
  setDriveOptions: patch => set(patch),
  setLastRun: lastRunId => set({ lastRunId }),
  setInterrupted: interrupted => set({ interrupted }),
  setTrying: trying => set({ trying }),
}))
