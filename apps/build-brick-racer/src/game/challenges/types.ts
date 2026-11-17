import type { EnvironmentId } from '../env/types'
import type { V3 } from '../math'

export type ChallengeId
  = | 'kitchen_sprint' | 'kitchen_acceleration' | 'kitchen_braking' | 'kitchen_drift'
    | 'kitchen_coast' | 'garden_mud' | 'garden_climb' | 'garden_jump'

export const CHALLENGE_IDS: readonly ChallengeId[] = [
  'kitchen_sprint',
  'kitchen_acceleration',
  'kitchen_braking',
  'kitchen_drift',
  'kitchen_coast',
  'garden_mud',
  'garden_climb',
  'garden_jump',
]

export type PowerMode = 'motor' | 'gravity'

export type MetricId
  = | 'time' | 'peakSpeed' | 'accelTime' | 'stoppingDistance' | 'driftScore' | 'jumpDistance'
    | 'progress' | 'exitSpeed' | 'entrySpeed' | 'resets'

/** Which direction is an improvement for a metric. */
export const METRIC_BETTER: Record<MetricId, 'lower' | 'higher' | 'info'> = {
  time: 'lower',
  peakSpeed: 'info',
  accelTime: 'lower',
  stoppingDistance: 'lower',
  driftScore: 'higher',
  jumpDistance: 'higher',
  progress: 'higher',
  exitSpeed: 'higher',
  entrySpeed: 'info',
  resets: 'lower',
}

/** Horizontally oriented box. `yaw` rotates about +Y, 0 = +Z. */
export interface ZoneBox {
  centre: V3
  half: V3
  yaw: number
}

export interface Gate {
  id: string
  kind: 'checkpoint' | 'finish' | 'entry' | 'measure' | 'motor_cut'
  /** Centre of the gate plane. */
  centre: V3
  /** Heading the car must cross in, radians about +Y (0 = +Z). */
  yaw: number
  halfWidth: number
  halfHeight: number
  label?: string
}

export type Marker
  = | { kind: 'lane', zone: ZoneBox, colour: string, label?: string }
    | { kind: 'cones', points: V3[], colour: string }
    | { kind: 'arc', centre: [number, number], radius: number, start: number, end: number, y: number, colour: string }

export interface DriftZone {
  centre: [number, number]
  inner: number
  outer: number
  /** Angles about +Y from +X, counter-clockwise seen from above. */
  startAngle: number
  endAngle: number
}

export type RuleConfig
  = | { kind: 'gate_race' }
    | { kind: 'target_speed', targetSpeed: number, hold: number }
    | { kind: 'brake_test', targetEntrySpeed: number, tolerance: number, lane: ZoneBox, stopSpeed: number, stopHold: number }
    | { kind: 'drift', zone: DriftZone, minSpeed: number, slipMinDeg: number, slipMaxDeg: number, minContinuous: number }
    | { kind: 'coast', targetEntrySpeed: number, tolerance: number }
    | { kind: 'jump', takeoff: ZoneBox, landingHold: number }

export interface ChallengeDefinition {
  id: ChallengeId
  version: number
  environment: EnvironmentId
  environmentVersion: number
  name: string
  shortName: string
  objective: string
  /** Short cue shown on the card, e.g. "Cross the mud". */
  tagline: string
  powerMode: PowerMode
  /** Ground contact point and heading for the start. The car is lowered onto the ground here. */
  start: { position: V3, yaw: number }
  /** Volume that must be clear for the car to spawn. */
  spawnClearance: ZoneBox
  /** Ordered gates. The last `finish` ends gate races. Kinds other than `checkpoint` have rule-specific meaning. */
  gates: Gate[]
  outOfBounds: ZoneBox[]
  rule: RuleConfig
  metrics: { primary: MetricId, secondary: MetricId[] }
  /** Authored "Great run" threshold in the primary metric's unit. Provisional until playtested. */
  thresholds: { great: number }
  /** Seconds before an unfinished attempt ends. */
  timeLimit: number
  markers: Marker[]
}

export type CompletionLevel = 'finished' | 'great' | 'best'
export type RunStatus = 'finished' | 'ended' | 'abandoned' | 'interrupted'
