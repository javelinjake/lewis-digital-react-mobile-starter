/**
 * Versioned physics configuration. Values are provisional gameplay tuning and are expected to change
 * after playtesting; bump `version` whenever behaviour changes so results are never compared across
 * different physics. All distances are game metres (see units.ts), forces in newtons.
 */
import type { TyreId } from '../catalog/types'
import { UNITS } from '../units'

export type SurfaceId = 'plastic' | 'tile' | 'grass' | 'mud' | 'wood'
export type AssistMode = 'off' | 'light'

export interface SurfaceDefinition {
  id: SurfaceId
  label: string
  /** Friction coefficient multiplier. */
  grip: number
  /** Rolling resistance coefficient (force per newton of load). */
  rolling: number
  /** Extra sink resistance coefficient; mud only. Reduced by wide and large tyres. */
  sink: number
  effect: 'none' | 'dust' | 'dirt' | 'splash'
}

export interface TyreDefinition {
  id: TyreId
  /** Lateral grip as a fraction of longitudinal grip. */
  lateralRatio: number
  /** Rolling resistance multiplier on hard surfaces. */
  rolling: number
  /** Grip multiplier per surface. */
  surfaceGrip: Record<SurfaceId, number>
}

export const PHYSICS_VERSION = 1

export const physicsConfig = {
  id: 'toy-v1',
  version: PHYSICS_VERSION,
  units: UNITS,
  tickHz: 60,
  /** Physics substeps per tick (the Rapier timestep is 1/(tickHz*substeps)). */
  substeps: 2,
  gravity: 9.81,

  motor: {
    /** Stall torque at the driven wheel shafts, N*m. Shared by all driven wheels. */
    stallTorque: 2.1,
    /** Wheel angular speed (rad/s) where torque falls to zero. */
    freeSpeed: 62,
    /** Power limit, watts. */
    powerLimit: 34,
    /** Reverse torque as a fraction of forward torque. */
    reverseFactor: 0.6,
  },

  brakes: {
    /** Peak brake torque per braking wheel, N*m. Grip is normally the limit. */
    torquePerWheel: 6,
    /** Seconds of sustained brake at standstill before reverse engages. */
    reverseDelay: 0.45,
    /** Speed under which the car counts as stationary, m/s. */
    standstill: 0.15,
  },

  suspension: {
    /** Droop beyond the tyre radius, as a fraction of radius. */
    travelFrac: 0.3,
    /** Static compression as a fraction of travel. */
    sagFrac: 0.5,
    dampingRatio: 0.45,
    /** Caps tyre load spikes, in multiples of static wheel load. */
    maxLoadFactor: 5,
  },

  tyre: {
    /** Rate (1/s) at which contact patches try to cancel slip speed when gripping. */
    stickRate: 38,
    /** Wheel spin inertia as a multiple of m*r^2 (slip visuals). */
    spinInertia: 0.5,
  },

  steering: {
    maxAngleDeg: 30,
    /** Digital steering ramp, per second. */
    rampUp: 5,
    rampDown: 7,
  },

  aero: {
    /** Gameplay air density scale (not real air; chosen so drag is noticeable at toy speeds). */
    density: 3.2,
    bodyDragCoefficient: 0.9,
    wingDragCoefficient: 0.9,
    wingLiftCoefficient: 3.5,
  },

  assist: {
    light: {
      /** Steering angle is divided by 1 + (speed/reference)^2. */
      speedReference: 3.2,
      /** Yaw rate beyond (1 + tolerance) x expected is damped at this rate, 1/s. */
      yawDamping: 3.5,
      yawTolerance: 0.55,
    },
  },

  surfaces: {
    plastic: { id: 'plastic', label: 'Toy track', grip: 1.05, rolling: 0.012, sink: 0, effect: 'none' },
    tile: { id: 'tile', label: 'Kitchen tile', grip: 0.85, rolling: 0.014, sink: 0, effect: 'dust' },
    grass: { id: 'grass', label: 'Grass', grip: 0.72, rolling: 0.034, sink: 0, effect: 'dirt' },
    mud: { id: 'mud', label: 'Mud', grip: 0.6, rolling: 0.05, sink: 0.06, effect: 'splash' },
    wood: { id: 'wood', label: 'Wood plank', grip: 0.95, rolling: 0.016, sink: 0, effect: 'dust' },
  } satisfies Record<SurfaceId, SurfaceDefinition>,

  tyres: {
    small: { id: 'small', lateralRatio: 0.88, rolling: 1.1, surfaceGrip: { plastic: 0.95, tile: 0.9, grass: 0.7, mud: 0.6, wood: 0.95 } },
    road: { id: 'road', lateralRatio: 0.85, rolling: 1.0, surfaceGrip: { plastic: 1.1, tile: 1.05, grass: 0.75, mud: 0.6, wood: 1.05 } },
    wide: { id: 'wide', lateralRatio: 0.92, rolling: 1.15, surfaceGrip: { plastic: 1.15, tile: 1.1, grass: 0.95, mud: 0.8, wood: 1.1 } },
    offroad: { id: 'offroad', lateralRatio: 0.95, rolling: 1.35, surfaceGrip: { plastic: 0.95, tile: 0.85, grass: 1.2, mud: 1.3, wood: 1.0 } },
  } satisfies Record<TyreId, TyreDefinition>,

  /** A wheel that rubs bodywork gains this much extra rolling resistance (matches the editor warning). */
  rubbingResistance: 1.8,
} as const

export type PhysicsConfiguration = typeof physicsConfig

/** Surface settings that decide whether two runs can be compared. Bump with any surface change. */
export const SURFACE_SIGNATURE = `surfaces-v1:${Object.values(physicsConfig.surfaces).map(s => `${s.id}${s.grip}${s.rolling}${s.sink}`).join('|')}`
