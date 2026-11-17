import type { Q4, V3 } from '../math'
import type { SurfaceId } from '../vehicle/physics-config'

export type EnvironmentId = 'kitchen' | 'garden'

export type BoxKind = 'ground' | 'wall' | 'prop'

export interface StaticBox {
  id: string
  centre: V3
  half: V3
  rot?: Q4
  surface: SurfaceId
  /** Ground is drivable. Walls and props are solid obstacles that count as wall contact. */
  kind: BoxKind
  /** Visual material key and tint. Hidden boxes only exist for physics. */
  look?: { material: 'tile' | 'plastic' | 'grass' | 'mud' | 'wood' | 'cabinet' | 'metal' | 'soil' | 'ceramic' | 'plain', colour: string, hidden?: boolean }
}

export interface DecoProp {
  id: string
  shape: 'box' | 'cylinder' | 'sphere' | 'cone'
  centre: V3
  /** Box: full size. Cylinder/cone: [diameter, height, diameter]. Sphere: [d, d, d]. */
  size: V3
  rot?: Q4
  colour: string
}

export interface CameraVolume {
  min: V3
  max: V3
  preset: 'chase' | 'close' | 'high'
}

export interface ReplayShot {
  id: string
  position: V3
  target: V3
  /** Which event makes this the preferred cinematic shot. */
  near: 'jump' | 'mud' | 'corner' | 'finish' | 'any'
}

export interface EnvironmentDefinition {
  id: EnvironmentId
  version: number
  label: string
  boxes: StaticBox[]
  props: DecoProp[]
  sky: { top: string, bottom: string }
  fogColour: string
  fogFar: number
  cameraVolumes: CameraVolume[]
  replayShots: ReplayShot[]
  /** Below this height the car has left the world. */
  killY: number
}
