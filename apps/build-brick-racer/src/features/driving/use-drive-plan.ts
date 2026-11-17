import type { CarDocument } from '@/game/build/types'
import type { ChallengeDefinition } from '@/game/challenges/types'
import type { EnvironmentDefinition } from '@/game/env/types'
import type { VehicleSpec } from '@/game/vehicle/compile'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { catalog } from '@/game/catalog/catalog'
import { ENVIRONMENTS, getChallenge } from '@/game/challenges'
import { fitsSpawn } from '@/game/challenges/spawn'
import { assessDrive } from '@/game/vehicle/analysis'
import { getRepo } from '@/lib/platform/repo'
import { usePrefsStore } from '@/stores/prefs.store'
import { useSessionStore } from '@/stores/session.store'

export interface DrivePlan {
  doc: CarDocument
  spec: VehicleSpec
  challenge: ChallengeDefinition | null
  env: EnvironmentDefinition
  warnings: string[]
}

export type PlanState
  = | { status: 'loading' }
    | { status: 'ready', plan: DrivePlan }
    | { status: 'missing' }
    | { status: 'blocked', message: string, carId: string }
    | { status: 'nofit', message: string, doc: CarDocument, challenge: ChallengeDefinition }

/**
 * Decides what to drive: the chosen car, the challenge (or free drive) and where. Deep links work too:
 * `/drive?challenge=kitchen_sprint&car=<id>` or `?challenge=free&place=garden`.
 */
export function useDrivePlan(nonce: number): PlanState {
  const [params] = useSearchParams()
  const [state, setState] = useState<PlanState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const session = useSessionStore.getState()
      const repo = getRepo()
      const wantedChallenge = params.get('challenge')
      const challenge = wantedChallenge
        ? (wantedChallenge === 'free' ? null : (getChallenge(wantedChallenge) ?? null))
        : (session.challengeId ? getChallenge(session.challengeId) ?? null : null)
      const place = (params.get('place') as 'kitchen' | 'garden' | null) ?? challenge?.environment ?? session.place

      let carId = params.get('car') ?? session.carId ?? usePrefsStore.getState().prefs.lastCarId
      if (!carId)
        carId = (await repo.listCars())[0]?.id ?? null
      const loaded = carId ? await repo.loadCar(carId) : null
      if (cancelled)
        return
      if (!loaded || !carId) {
        setState({ status: 'missing' })
        return
      }
      const assessment = assessDrive(loaded.doc, catalog)
      if (assessment.blocks.length > 0 || !assessment.spec) {
        setState({ status: 'blocked', message: assessment.blocks[0]?.message ?? 'This car cannot be built for the track.', carId })
        return
      }
      if (challenge) {
        const fit = fitsSpawn(challenge, assessment.spec)
        if (!fit.fits) {
          setState({ status: 'nofit', message: fit.reason ?? 'This car is too big for the start area.', doc: loaded.doc, challenge })
          return
        }
      }
      useSessionStore.getState().chooseCar(carId)
      setState({
        status: 'ready',
        plan: {
          doc: loaded.doc,
          spec: assessment.spec,
          challenge,
          env: challenge ? ENVIRONMENTS[challenge.environment] : ENVIRONMENTS[place],
          warnings: assessment.warnings.map(w => w.message),
        },
      })
    })()
    return () => {
      cancelled = true
    }
  }, [params, nonce])

  return state
}
