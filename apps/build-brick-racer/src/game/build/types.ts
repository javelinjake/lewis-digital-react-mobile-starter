import type { PartCategory } from '../catalog/types'
import type { Rot, V3I } from '../lattice'

export const CAR_SCHEMA_VERSION = 1

/** Lattice axis the car faces. Stored with the car, never inferred from the bounding box. */
export type Forward = 'x+' | 'x-' | 'z+' | 'z-'

export interface PartInstance {
  /** Stable id, independent of array position, labels and asset names. */
  id: string
  defId: string
  /** Definition version the instance was built with. */
  defVersion: number
  /** Minimum corner of the rotated part bounds, in lattice units. */
  pos: V3I
  rot: Rot
  colour: string
  config?: Record<string, string | number | boolean>
}

export interface ConnectorRef {
  instanceId: string
  connectorId: string
}

export interface Connection {
  id: string
  a: ConnectorRef
  b: ConnectorRef
  type: 'stud' | 'axle'
}

export interface WheelGroup {
  id: string
  instanceIds: string[]
  driven: boolean
  steering: boolean
  braking: boolean
  /** -1 steers the opposite way (rear steer). */
  steerDirection: 1 | -1
  /** True once the player set roles. Defaults (front-most axle steers) stop re-deriving for this group. */
  userRoles: boolean
  /** Left/right wheel pairs inside the group. */
  symmetry: Array<[string, string]>
}

export interface CarUiState {
  category: PartCategory
  /** Doubled X of the mirror plane, null until the player turns on mirroring. */
  mirrorPlane2: number | null
  camera: { yaw: number, pitch: number, distance: number, target: [number, number, number] } | null
}

export interface CarDocument {
  schemaVersion: number
  carId: string
  revisionId: string
  parentRevisionId: string | null
  name: string
  createdAt: string
  updatedAt: string
  starterId: string | null
  forward: Forward
  rootInstanceId: string | null
  instances: PartInstance[]
  connections: Connection[]
  wheelGroups: WheelGroup[]
  ui: CarUiState
  thumbnailRef: string | null
}

export type IssueSeverity = 'block' | 'warn'

export interface BuildIssue {
  code:
    | 'overlap' | 'unknown_part' | 'rotation_not_allowed' | 'not_connected' | 'wheel_unmounted'
    | 'wheel_touches_body' | 'wheel_touches_wheel' | 'unsupported_connector' | 'nothing_to_drive'
    | 'no_wheels' | 'no_steering' | 'high_centre' | 'poor_balance' | 'low_clearance' | 'odd_wheels'
    | 'unlikely_finish' | 'non_finite_mass' | 'loose_pieces' | 'mirror_unavailable' | 'duplicate_id'
    | 'paired_failed' | 'floating_wheel'
  severity: IssueSeverity
  /** Parts to highlight in the editor. */
  instanceIds: string[]
  /** One short, child-readable sentence. */
  message: string
}

export type EditResult
  = | { ok: true, doc: CarDocument, warnings: BuildIssue[], created?: string[] }
    | { ok: false, issues: BuildIssue[] }

export const FORWARD_VECTORS: Record<Forward, V3I> = {
  'z+': [0, 0, 1],
  'z-': [0, 0, -1],
  'x+': [1, 0, 0],
  'x-': [-1, 0, 0],
}
