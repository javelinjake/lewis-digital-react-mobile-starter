import type { Rule } from './types'
import { crossesGate, driftPolar } from '../geometry'
import { endRun, finish, hitWall } from './types'

const POINTS_PER_METRE = 10

/**
 * Slide Corner. Score accrues only while sliding inside the marked corner: slip angle in range, above
 * the minimum speed, moving forward through the zone and not spinning. A qualifying slide must last
 * the minimum continuous time before it scores. Spins, reversing, wall contact and wheelspin while
 * (nearly) stationary score nothing.
 */
export function createDrift(): Rule {
  let score = 0
  let streak = 0
  let pending = 0
  let credited = false
  let lastAngle: number | null = null
  let sawZone = false
  let wallCooldown = 0
  return {
    tick(run, tick, def) {
      if (def.rule.kind !== 'drift')
        return
      const r = def.rule
      const { state, dt } = tick
      const polar = driftPolar(r.zone, state.pos)
      const slipDeg = (state.slipAngle * 180) / Math.PI
      const progressing = lastAngle !== null && polar.angle >= lastAngle - 1e-4
      lastAngle = polar.angle
      if (hitWall(tick.events))
        wallCooldown = 0.6
      const wall = wallCooldown > 0
      wallCooldown = Math.max(0, wallCooldown - dt)
      if (polar.inside)
        sawZone = true

      const spinning = Math.abs(state.yawRate) > 4
      const qualifies = polar.inside && !wall && !spinning && progressing
        && state.speed >= r.minSpeed && state.forwardSpeed > 0.3
        && slipDeg >= r.slipMinDeg && slipDeg <= r.slipMaxDeg

      if (qualifies) {
        streak += dt
        const rate = state.speed * (0.6 + 0.4 * Math.min(1, slipDeg / 25)) * POINTS_PER_METRE
        if (credited) {
          score += rate * dt
        }
        else {
          pending += rate * dt
          if (streak >= r.minContinuous) {
            score += pending
            credited = true
          }
        }
      }
      else {
        streak = 0
        pending = 0
        credited = false
      }

      run.metrics.driftScore = score
      run.hud.slip = slipDeg
      run.hud.sliding = qualifies
      run.hud.streak = streak

      const exit = def.gates.find(g => g.kind === 'finish')
      if (exit && sawZone && crossesGate(exit, tick.prev.pos, state.pos) !== null) {
        if (score > 0)
          finish(run, run.t)
        else
          endRun(run, 'failed', 'No slide scored. Try a wider, faster turn.')
      }
    },
    onReset() {
      streak = 0
      pending = 0
      credited = false
      lastAngle = null
      wallCooldown = 0
    },
  }
}
