/**
 * Challenge controller. Owns timing, scoring, eligibility and completion for one attempt. It reads the
 * simulation and the player's inputs; it never produces driving input.
 */
import type { VehicleSpec } from '../vehicle/compile'
import type { Rule, RunState, Tick } from './rules/types'
import type { ChallengeDefinition, MetricId } from './types'
import { inZone } from './geometry'
import { createBrakeTest } from './rules/brake-test'
import { createCoast } from './rules/coast'
import { createDrift } from './rules/drift'
import { createGateRace } from './rules/gate-race'
import { createJump } from './rules/jump'
import { createTargetSpeed } from './rules/target-speed'
import { endRun } from './rules/types'
import { RESET_PROMPT_SECONDS, StuckMonitor } from './stuck'

function createRule(def: ChallengeDefinition): Rule {
  switch (def.rule.kind) {
    case 'gate_race': return createGateRace()
    case 'target_speed': return createTargetSpeed()
    case 'brake_test': return createBrakeTest()
    case 'drift': return createDrift()
    case 'coast': return createCoast()
    case 'jump': return createJump()
  }
}

export { RESET_PROMPT_SECONDS }

export class ChallengeRun {
  readonly run: RunState
  private readonly rule: Rule
  private filtered = 0
  private readonly stuck = new StuckMonitor()

  constructor(readonly def: ChallengeDefinition, readonly killY: number, readonly spec?: VehicleSpec) {
    this.rule = createRule(def)
    this.run = {
      phase: 'ready',
      t: 0,
      gateIndex: 0,
      progress: 0,
      metrics: {},
      invalid: new Set(),
      resets: 0,
      motorEnabled: def.powerMode === 'motor',
      message: null,
      endReason: null,
      hud: {},
      checkpoint: null,
    }
  }

  get resetSuggested(): boolean {
    return this.stuck.suggested
  }

  /** Go: timing starts. */
  start(): void {
    if (this.run.phase === 'ready')
      this.run.phase = 'running'
  }

  /** The player reset the car. The attempt continues as a practice run. */
  noteReset(): void {
    const r = this.run
    r.resets += 1
    r.invalid.add('Reset used')
    r.metrics.resets = r.resets
    r.motorEnabled = this.def.powerMode === 'motor'
    this.stuck.reset()
    this.rule.onReset?.(r)
  }

  /** The player left the attempt without finishing. Progress made so far stays on the record. */
  abandon(): void {
    const r = this.run
    if (r.phase === 'running')
      endRun(r, 'abandoned', 'Run ended')
  }

  update(tick: Tick): RunState {
    const r = this.run
    if (r.phase !== 'running')
      return r
    r.t += tick.dt

    this.filtered += (tick.state.speed - this.filtered) * 0.25
    r.metrics.peakSpeed = Math.max(r.metrics.peakSpeed ?? 0, this.filtered)

    this.rule.tick(r, tick, this.def)
    if (r.phase !== 'running')
      return r

    if (tick.state.pos[1] < this.killY || this.def.outOfBounds.some(z => inZone(z, tick.state.pos)))
      endRun(r, 'out_of_bounds', 'Run ended')
    else if (r.t >= this.def.timeLimit)
      endRun(r, 'timeout', 'Time is up. Try again!')

    this.trackStuck(tick)
    return r
  }

  private trackStuck(tick: Tick): void {
    const wantsToMove = this.def.powerMode === 'gravity' && this.run.t > 2
    this.stuck.update(tick.state, tick.input, wantsToMove, tick.dt)
  }
}

export const primaryMetric = (def: ChallengeDefinition): MetricId => def.metrics.primary
