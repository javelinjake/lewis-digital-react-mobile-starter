import type { V3 } from '../../math'
import type { Rule } from './types'
import { crossesGate, horizontalDistance, inZone } from '../geometry'
import { endRun, finish, hitWall } from './types'

/**
 * Stop Box. Entry speed is read at the entry gate. The distance runs from the first brake command
 * inside the lane to a stable stop. A wall hit, a reset or leaving the lane keeps the practice attempt
 * but invalidates the record; entry speed outside the tolerance makes the result not comparable.
 */
export function createBrakeTest(): Rule {
  let entered = false
  let braking = false
  let last: V3 | null = null
  let distance = 0
  let stableFor = 0
  let distAtStable = 0
  let idleFor = 0
  return {
    tick(run, tick, def) {
      if (def.rule.kind !== 'brake_test')
        return
      const r = def.rule
      const { state, input, dt } = tick
      run.hud.target = r.targetEntrySpeed
      run.hud.tolerance = r.tolerance

      if (!entered) {
        const entry = def.gates[0]
        const t = entry ? crossesGate(entry, tick.prev.pos, state.pos) : null
        if (t !== null) {
          entered = true
          run.metrics.entrySpeed = state.speed
          if (Math.abs(state.speed - r.targetEntrySpeed) / r.targetEntrySpeed > r.tolerance)
            run.invalid.add('Entry speed outside the marked range')
          run.hud.entered = true
        }
        else if (state.pos[2] > r.lane.centre[2] + r.lane.half[2] + 2) {
          endRun(run, 'failed', 'You missed the box. Try again.')
        }
        return
      }

      if (hitWall(tick.events))
        run.invalid.add('Hit a wall')

      if (!braking) {
        if (input.brake > 0.05 && inZone(r.lane, state.pos)) {
          braking = true
          last = state.pos
          distance = 0
        }
        else if (state.speed < 0.2) {
          idleFor += dt
          if (idleFor > 1.5)
            endRun(run, 'stopped', 'Brake inside the box to measure your stop.')
        }
        else {
          idleFor = 0
        }
        return
      }

      if (last)
        distance += horizontalDistance(state.pos, last)
      last = state.pos
      run.hud.distance = distance
      if (!inZone(r.lane, state.pos))
        run.invalid.add('Left the lane')

      const planar = Math.hypot(state.vel[0], state.vel[2])
      if (planar < r.stopSpeed) {
        if (stableFor === 0)
          distAtStable = distance
        stableFor += dt
        if (stableFor >= r.stopHold) {
          run.metrics.stoppingDistance = distAtStable
          finish(run)
        }
      }
      else {
        stableFor = 0
      }
    },
    onReset(run) {
      entered = false
      braking = false
      last = null
      distance = 0
      stableFor = 0
      idleFor = 0
      delete run.metrics.entrySpeed
      run.hud.entered = false
    },
  }
}
