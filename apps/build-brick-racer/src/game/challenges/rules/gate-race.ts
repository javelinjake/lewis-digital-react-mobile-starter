import type { Rule } from './types'
import { crossesGate } from '../geometry'
import { finish } from './types'

/** Ordered gates. A later gate never counts before the earlier ones, so shortcuts cannot finish a run. */
export function createGateRace(): Rule {
  return {
    tick(run, tick, def) {
      const gates = def.gates
      const next = gates[run.gateIndex]
      if (!next)
        return
      const t = crossesGate(next, tick.prev.pos, tick.state.pos)
      if (t !== null) {
        run.gateIndex += 1
        if (next.kind === 'checkpoint')
          run.checkpoint = { pos: [next.centre[0], next.centre[1], next.centre[2]], yaw: next.yaw }
        if (next.kind === 'finish' && run.gateIndex === gates.length) {
          finish(run, run.t - tick.dt * (1 - t))
          run.progress = 1
          return
        }
      }
      const from = gates[run.gateIndex - 1]?.centre ?? def.start.position
      const to = gates[run.gateIndex]?.centre
      if (!to)
        return
      const seg: [number, number] = [to[0] - from[0], to[2] - from[2]]
      const len = Math.hypot(seg[0], seg[1]) || 1
      const along = ((tick.state.pos[0] - from[0]) * seg[0] + (tick.state.pos[2] - from[2]) * seg[1]) / (len * len)
      const frac = Math.max(0, Math.min(1, along))
      run.progress = Math.max(run.progress, (run.gateIndex + frac) / gates.length)
      run.hud.nextGate = next.id
    },
  }
}
