import type { CarDocument } from '@/game/build/types'
import type { ChallengeDefinition } from '@/game/challenges/types'
import type { EnvironmentDefinition } from '@/game/env/types'
import type { RunRecord } from '@/game/persistence/types'
import type { ReplayRecord } from '@/game/replay/types'
import type { VehicleSpec } from '@/game/vehicle/compile'
import { useEffect, useState } from 'react'
import { catalog } from '@/game/catalog/catalog'
import { ENVIRONMENTS, getChallenge } from '@/game/challenges'
import { compileVehicle } from '@/game/vehicle/compile'
import { getRepo } from '@/lib/platform/repo'

export interface ReplayData {
  run: RunRecord
  record: ReplayRecord
  doc: CarDocument
  spec: VehicleSpec
  env: EnvironmentDefinition
  challenge: ChallengeDefinition | null
}

export type ReplayLoad =
  | { status: 'loading' }
  | { status: 'ready', data: ReplayData }
  | { status: 'norun' }
  | { status: 'unavailable', run: RunRecord, reason: string }

/**
 * Loads a run, its recorded replay and the car snapshot from that exact attempt (so editing the saved car
 * afterwards never changes what the replay shows).
 */
export function useReplayData(runId: string | undefined): ReplayLoad {
  const [state, setState] = useState<ReplayLoad>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const repo = getRepo()
      const run = runId ? await repo.getRun(runId) : undefined
      if (cancelled)
        return
      if (!run) {
        setState({ status: 'norun' })
        return
      }
      const record = run.replayRef ? await repo.getReplay(run.id) : undefined
      if (!record || record.samples.length === 0) {
        setState({ status: 'unavailable', run, reason: 'This replay was cleared to save space, or it could not be saved. Your result is still saved.' })
        return
      }
      const snapshot = await repo.getSnapshot(run.carSnapshotId)
      const compiled = snapshot ? compileVehicle(snapshot.doc, catalog) : null
      if (cancelled)
        return
      if (!snapshot || !compiled?.ok) {
        setState({ status: 'unavailable', run, reason: 'The car from this run could not be rebuilt for the replay. Your result is still saved.' })
        return
      }
      const challenge = getChallenge(run.challengeId) ?? null
      setState({
        status: 'ready',
        data: {
          run,
          record,
          doc: snapshot.doc,
          spec: compiled.spec,
          env: ENVIRONMENTS[challenge?.environment ?? 'kitchen'],
          challenge,
        },
      })
    })()
    return () => {
      cancelled = true
    }
  }, [runId])

  return state
}
