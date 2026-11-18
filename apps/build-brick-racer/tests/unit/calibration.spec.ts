import type { ChallengeId, MetricId } from '@/game/challenges/types'
import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { buildStarter } from '@/game/catalog/starters'
import { getChallenge } from '@/game/challenges'
import { isGreat } from '@/game/challenges/eval'
import { runChallenge } from './autopilot'

/**
 * Regression table from scripted input traces (development harness only). Values are provisional
 * tuning: they pin the behaviour of physics v1 so unintended changes are noticed, and the authored
 * "Great run" thresholds sit between the two starter cars.
 */
const EXPECTED: Array<{ car: 'racer' | 'buggy', id: ChallengeId, metric: MetricId, value: number, great: boolean }> = [
  { car: 'racer', id: 'kitchen_sprint', metric: 'time', value: 10.5, great: true },
  { car: 'buggy', id: 'kitchen_sprint', metric: 'time', value: 11.2, great: false },
  { car: 'racer', id: 'kitchen_acceleration', metric: 'accelTime', value: 1.5, great: true },
  { car: 'buggy', id: 'kitchen_acceleration', metric: 'accelTime', value: 2.0, great: false },
  { car: 'racer', id: 'kitchen_braking', metric: 'stoppingDistance', value: 0.76, great: true },
  { car: 'buggy', id: 'kitchen_braking', metric: 'stoppingDistance', value: 0.94, great: false },
  { car: 'racer', id: 'kitchen_drift', metric: 'driftScore', value: 19.3, great: true },
  { car: 'racer', id: 'kitchen_coast', metric: 'exitSpeed', value: 1.86, great: true },
  { car: 'buggy', id: 'kitchen_coast', metric: 'exitSpeed', value: 1.64, great: false },
  { car: 'racer', id: 'garden_mud', metric: 'time', value: 17.4, great: false },
  { car: 'buggy', id: 'garden_mud', metric: 'time', value: 14.8, great: true },
  { car: 'racer', id: 'garden_climb', metric: 'time', value: 8.1, great: true },
  { car: 'buggy', id: 'garden_climb', metric: 'time', value: 9.4, great: false },
  { car: 'racer', id: 'garden_jump', metric: 'jumpDistance', value: 1.64, great: true },
  { car: 'buggy', id: 'garden_jump', metric: 'jumpDistance', value: 1.49, great: false },
]

describe('starter cars through all eight challenges (scripted traces)', () => {
  for (const row of EXPECTED) {
    it(`${row.car} ${row.id}`, async () => {
      const doc = buildStarter(row.car, sequentialContext('c'))
      const r = await runChallenge(doc, row.id)
      expect(r.outcome.status).toBe('finished')
      expect(r.outcome.eligible).toBe(true)
      const value = r.outcome.metrics[row.metric]!
      expect(value).toBeGreaterThan(row.value * 0.8)
      expect(value).toBeLessThan(row.value * 1.2)
      expect(isGreat(getChallenge(row.id)!, value), `great for ${value}`).toBe(row.great)
    }, 60000)
  }
})
