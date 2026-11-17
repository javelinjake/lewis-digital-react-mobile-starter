import type { ChallengeDefinition } from '@/game/challenges/types'
import type { CarSnapshot, RunRecord } from '@/game/persistence/types'
import { useEffect, useState } from 'react'
import { getChallenge } from '@/game/challenges'
import { getRepo } from '@/lib/platform/repo'

export type RunData
  = | { status: 'loading' }
    | { status: 'missing' }
    | {
      status: 'ready'
      run: RunRecord
      def: ChallengeDefinition
      previous: RunRecord | null
      snapshot: CarSnapshot | null
      previousSnapshot: CarSnapshot | null
      /** The saved car still exists in the garage. */
      carExists: boolean
    }

/** Everything a result screen needs, read from local storage. Works offline. */
export function useRunData(runId: string | undefined): RunData {
  const [data, setData] = useState<RunData>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setData({ status: 'loading' })
    void (async () => {
      const repo = getRepo()
      const run = runId ? await repo.getRun(runId) : undefined
      const def = run ? getChallenge(run.challengeId) : undefined
      if (!run || !def) {
        if (!cancelled)
          setData({ status: 'missing' })
        return
      }
      const previous = await repo.previousComparable(run)
      const snapshot = await repo.getSnapshot(run.carSnapshotId)
      const previousSnapshot = previous ? await repo.getSnapshot(previous.carSnapshotId) : null
      const carExists = Boolean(await repo.loadCar(run.carId))
      if (!cancelled)
        setData({ status: 'ready', run, def, previous, snapshot, previousSnapshot, carExists })
    })().catch(() => {
      if (!cancelled)
        setData({ status: 'missing' })
    })
    return () => {
      cancelled = true
    }
  }, [runId])

  return data
}
