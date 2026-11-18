import type { V3 } from '../../math'
import type { Rule } from './types'
import { horizontalDistance, inZone } from '../geometry'
import { endRun, finish } from './types'

const MIN_AIRTIME = 0.08

/**
 * Plank Jump. Take-off is the last grounded position inside the take-off zone when all wheels leave the
 * ground. The jump counts only if the car lands upright with wheel contact for the hold time.
 */
export function createJump(): Rule {
  let phase: 'approach' | 'flying' | 'landing' = 'approach'
  let lastGrounded: V3 = [0, 0, 0]
  let takeoff: V3 | null = null
  let flight = 0
  let landing: V3 | null = null
  let good = 0
  let bad = 0
  return {
    tick(run, tick, def) {
      if (def.rule.kind !== 'jump')
        return
      const r = def.rule
      const { state, dt } = tick
      run.hud.phase = phase

      if (phase === 'approach') {
        if (state.groundedWheels > 0) {
          lastGrounded = state.pos
        }
        else if (inZone(r.takeoff, lastGrounded)) {
          phase = 'flying'
          takeoff = lastGrounded
          flight = 0
        }
      }
      else if (phase === 'flying') {
        if (state.groundedWheels === 0) {
          // Only time spent off the ground counts as flight.
          flight += dt
          run.hud.airtime = flight
        }
        else if (flight > MIN_AIRTIME) {
          phase = 'landing'
          landing = state.pos
          good = 0
          bad = 0
        }
        else {
          // A bump or a one-tick loss of contact is not a jump.
          phase = 'approach'
          takeoff = null
          flight = 0
        }
      }
      else if (takeoff && landing) {
        const upright = state.upDot > 0.5 && state.groundedWheels >= 1
        if (upright) {
          good += dt
          bad = 0
        }
        else {
          bad += dt
          good = 0
        }
        run.metrics.jumpDistance = horizontalDistance(takeoff, landing)
        if (good >= r.landingHold) {
          finish(run, undefined)
        }
        else if (bad > 0.6 || state.upDot < 0.2) {
          delete run.metrics.jumpDistance
          endRun(run, 'failed', 'Not a clean landing. Land on your wheels to count.')
        }
      }
    },
    onReset() {
      phase = 'approach'
      takeoff = null
      landing = null
    },
  }
}
