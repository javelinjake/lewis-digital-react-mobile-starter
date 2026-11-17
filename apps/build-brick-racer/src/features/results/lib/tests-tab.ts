import type { ChallengeDefinition } from '@/game/challenges/types'
import type { RunRecord } from '@/game/persistence/types'
import { CHALLENGES } from '@/game/challenges'
import { isBetter } from '@/game/persistence/progress'
import { PHYSICS_VERSION } from '@/game/vehicle/physics-config'

export interface TestRow {
  def: ChallengeDefinition
  best: number | null
  great: boolean
}

/** Best eligible finished result per challenge for one car (current physics only). `null` = not tested yet. */
export function bestPerChallenge(runs: readonly RunRecord[]): TestRow[] {
  return Object.values(CHALLENGES).map((def) => {
    const mine = runs.filter(r => r.challengeId === def.id && r.status === 'finished' && r.eligible && r.physicsVersion === PHYSICS_VERSION)
    let best: number | null = null
    let great = false
    for (const r of mine) {
      const v = r.metrics[def.metrics.primary]
      if (v === undefined || !Number.isFinite(v))
        continue
      if (best === null || isBetter(def, v, best))
        best = v
      if (r.completion === 'great')
        great = true
    }
    return { def, best, great }
  })
}
