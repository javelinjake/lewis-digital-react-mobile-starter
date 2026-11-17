import type { Rule } from './types'
import { crossesGate } from '../geometry'
import { endRun, finish, hitWall } from './types'

/**
 * Coast Test. Crossing the entry gate cuts the motor. The player can still steer and brake, but braking or
 * hitting a wall means the exit speed is not comparable. Exit speed is read at the measurement gate.
 */
export function createCoast(): Rule {
  let entered = false
  let idleFor = 0
  return {
    tick(run, tick, def) {
      if (def.rule.kind !== 'coast')
        return
      const r = def.rule
      const { state, input, dt } = tick
      run.hud.target = r.targetEntrySpeed
      run.hud.tolerance = r.tolerance

      if (!entered) {
        const entry = def.gates.find(g => g.kind === 'entry')
        if (entry && crossesGate(entry, tick.prev.pos, state.pos) !== null) {
          entered = true
          run.motorEnabled = false
          run.metrics.entrySpeed = state.speed
          run.hud.entered = true
          if (Math.abs(state.speed - r.targetEntrySpeed) / r.targetEntrySpeed > r.tolerance)
            run.invalid.add('Entry speed outside the marked range')
        }
        return
      }

      if (input.brake > 0.1)
        run.invalid.add('Braked during the test')
      if (hitWall(tick.events))
        run.invalid.add('Hit a wall')

      const measure = def.gates.find(g => g.kind === 'measure')
      if (measure && crossesGate(measure, tick.prev.pos, state.pos) !== null) {
        run.metrics.exitSpeed = state.speed
        finish(run, undefined)
        return
      }
      if (state.speed < 0.15) {
        idleFor += dt
        if (idleFor > 1)
          endRun(run, 'stopped', 'You stopped before the end. Go a bit faster at the gate.')
      }
      else {
        idleFor = 0
      }
    },
    onReset() {
      entered = false
      idleFor = 0
    },
  }
}
