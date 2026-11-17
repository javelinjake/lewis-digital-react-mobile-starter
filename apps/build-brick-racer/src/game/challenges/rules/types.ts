import type { V3 } from '../../math'
import type { VehicleSpec } from '../../vehicle/compile'
import type { DriveInput } from '../../vehicle/input'
import type { SimEvent, VehicleState } from '../../vehicle/sim'
import type { ChallengeDefinition, MetricId } from '../types'

export type EndReason = 'finished' | 'out_of_bounds' | 'timeout' | 'stopped' | 'abandoned' | 'failed'

/** Mutable state a rule updates each tick. Owned by `ChallengeRun`. */
export interface RunState {
  phase: 'ready' | 'running' | 'finished' | 'ended'
  /** Fixed-tick time since Go, excluding pause. */
  t: number
  gateIndex: number
  /** 0..1 along the route. */
  progress: number
  metrics: Partial<Record<MetricId, number>>
  /** Reasons the attempt is a practice run. Any entry means not eligible for personal best. */
  invalid: Set<string>
  resets: number
  motorEnabled: boolean
  /** One short observation for the HUD. */
  message: string | null
  endReason: EndReason | null
  /** Live values for HUD cues (entry speed band, drift streak...). */
  hud: Record<string, number | string | boolean>
  /** Last checkpoint the car passed, used by reset. */
  checkpoint: { pos: V3, yaw: number } | null
}

export interface Tick {
  dt: number
  state: VehicleState
  prev: VehicleState
  input: DriveInput
  events: readonly SimEvent[]
  spec: VehicleSpec
}

export interface Rule {
  tick: (run: RunState, tick: Tick, def: ChallengeDefinition) => void
  onReset?: (run: RunState) => void
}

export function finish(run: RunState, time?: number): void {
  run.phase = 'finished'
  run.endReason = 'finished'
  if (time !== undefined)
    run.metrics.time = time
}

export function endRun(run: RunState, reason: EndReason, message: string): void {
  if (run.phase !== 'running')
    return
  run.phase = 'ended'
  run.endReason = reason
  run.message = message
}

export const hitWall = (events: readonly SimEvent[]): boolean => events.some(e => e.type === 'wall')
