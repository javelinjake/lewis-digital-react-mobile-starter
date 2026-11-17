import type { BoxI, Rot, V3I } from '../lattice'

export type PartCategory = 'bricks' | 'plates' | 'beams' | 'shaped' | 'fittings' | 'wheels' | 'details'

export type ConnectorType = 'stud' | 'socket' | 'axle' | 'hub'

/** Complementary connector type that this one can join to. */
export const MATING_TYPE: Record<ConnectorType, ConnectorType> = {
  stud: 'socket',
  socket: 'stud',
  axle: 'hub',
  hub: 'axle',
}

export interface ConnectorDefinition {
  /** Local connector id, stable inside the part definition. */
  id: string
  type: ConnectorType
  /** Position inside the part in DOUBLED lattice coordinates. */
  pos2: V3I
  /** Outward facing direction in part-local axes. */
  dir: V3I
  /** Both connectors need at least one shared tag to join. */
  tags: string[]
  /** Only one mate per connector in V1. */
  wheelMountRole?: 'mount'
}

export type TyreId = 'small' | 'road' | 'wide' | 'offroad'

export interface WheelProps {
  tyre: TyreId
  radiusM: number
  widthM: number
  massKg: number
}

export interface WingProps {
  /** Wing area in square metres. */
  areaM2: number
  /** Local lattice centre of the wing surface (studs, plates, studs). */
  centre: readonly [number, number, number]
}

export interface AeroProps {
  wing?: WingProps
}

export type VisualShape
  = | 'box' | 'slope' | 'wedge_left' | 'wedge_right' | 'curve' | 'beam' | 'chassis'
    | 'mount' | 'axle' | 'wheel' | 'wing' | 'bumper' | 'cockpit' | 'ballast'

export interface PartDefinition {
  id: string
  /** Bump when geometry, connectors or physics change. Saved instances record the version they were built with. */
  version: number
  category: PartCategory
  label: string
  /** Part bounds in lattice units: studs, plates, studs. */
  size: V3I
  /** Structural solids used for overlap, mass and collision. Local lattice coordinates. */
  boxes: BoxI[]
  connectors: ConnectorDefinition[]
  allowedRotations: Rot[]
  massKg: number
  /** Id of the definition that mirrors this one, `self` when symmetric, or null when it cannot be mirrored. */
  mirror: string | 'self' | null
  shape: VisualShape
  /** Named colour slots. `primary` follows the instance colour. */
  materialSlots: string[]
  /** Needs a deliberate second action to remove in Easy Build. */
  structural: boolean
  wheel?: WheelProps
  aero?: AeroProps
}
