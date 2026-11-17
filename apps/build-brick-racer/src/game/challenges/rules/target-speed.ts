import type { Rule } from './types'
import { finish } from './types'

/** Time to a target speed, which must be held briefly so a one-frame spike cannot count. */
export function createTargetSpeed(): Rule {
  let reached = -1
  let held = 0
  return {
    tick(run, tick, def) {
      if (def.rule.kind !== 'target_speed')
        return
      const { targetSpeed: target, hold } = def.rule
      run.hud.target = target
      if (tick.state.forwardSpeed >= target) {
        if (reached < 0)
          reached = run.t
        held += tick.dt
        if (held >= hold) {
          run.metrics.accelTime = reached
          finish(run)
        }
      }
      else {
        reached = -1
        held = 0
      }
    },
    onReset() {
      reached = -1
      held = 0
    },
  }
}
