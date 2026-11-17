import type { WheelSpec } from './compile'
/**
 * Tyre contact model. Pure functions so grip, braking and drift behaviour can be unit tested without a
 * physics engine. Forces are in newtons, speeds in m/s, at one wheel's contact patch.
 */
import type { SurfaceId } from './physics-config'
import { physicsConfig } from './physics-config'

export interface TyreInput {
  /** Normal load on the contact patch. */
  load: number
  vLong: number
  vLat: number
  muX: number
  muY: number
  /** Signed longitudinal force the motor asks for at this wheel. */
  driveForce: number
  brakeInput: number
  /** Brake force cap at this wheel (torque / radius). */
  brakeCap: number
  /** Share of the car's mass this contact is responsible for. */
  mEff: number
  stickRate: number
}

export interface TyreOutput {
  fx: number
  fy: number
  /** True when demand exceeded grip (sliding, spinning or locked). */
  sliding: boolean
  /** Fraction of available grip in use, 0..1+. */
  usage: number
}

/** Sliding friction is a little weaker than peak grip. */
export const KINETIC_FACTOR = 0.9

export function tyreForces(i: TyreInput): TyreOutput {
  const fxMax = Math.max(1e-6, i.muX * i.load)
  // Power oversteer: drive force a driven tyre carries takes lateral grip away beyond the plain friction
  // ellipse, so a rear-driven car can step out under throttle. Gameplay model, tuned in physics-config.
  const driveUse = Math.min(1, Math.abs(i.driveForce) / fxMax)
  const fyMax = Math.max(1e-6, i.muY * i.load * (1 - physicsConfig.tyre.powerSlide * driveUse))

  let fxDemand = i.driveForce
  if (i.brakeInput > 0.001) {
    const hold = i.mEff * i.stickRate * Math.abs(i.vLong)
    fxDemand += -Math.sign(i.vLong) * Math.min(i.brakeCap * i.brakeInput, hold)
  }
  const fyDemand = -i.mEff * i.stickRate * i.vLat

  const usage = Math.hypot(fxDemand / fxMax, fyDemand / fyMax)
  if (usage <= 1)
    return { fx: fxDemand, fy: fyDemand, sliding: false, usage }
  const s = KINETIC_FACTOR / usage
  return { fx: fxDemand * s, fy: fyDemand * s, sliding: true, usage }
}

/** Rolling resistance force magnitude opposing motion; smooth through zero speed. */
export function rollingResistance(load: number, coefficient: number, vLong: number): number {
  return -coefficient * load * Math.tanh(vLong / 0.06)
}

/** Wide and large tyres float on mud. Returns 1 for a 0.1 m radius, 0.1 m wide tyre. */
export function sinkFactor(radius: number, width: number): number {
  return (0.1 / radius) ** 0.7 * (0.1 / width) ** 0.5
}

export function surfaceGrip(wheel: Pick<WheelSpec, 'tyre'>, surface: SurfaceId): { muX: number, muY: number } {
  const tyre = physicsConfig.tyres[wheel.tyre]
  const muX = physicsConfig.surfaces[surface].grip * tyre.surfaceGrip[surface]
  return { muX, muY: muX * tyre.lateralRatio }
}

/** Total rolling coefficient for a wheel on a surface, including mud sink and rubbing. */
export function rollingCoefficient(wheel: Pick<WheelSpec, 'tyre' | 'radius' | 'width' | 'rubbing'>, surface: SurfaceId): number {
  const tyre = physicsConfig.tyres[wheel.tyre]
  const surf = physicsConfig.surfaces[surface]
  const base = surf.rolling * tyre.rolling * (wheel.rubbing ? physicsConfig.rubbingResistance : 1)
  return base + surf.sink * sinkFactor(wheel.radius, wheel.width)
}

/** Shared motor: one fixed total output split across driven wheels. Returns total wheel torque, N*m. */
export function motorTorque(wheelSpeed: number, throttle: number, reverse: boolean): number {
  const m = physicsConfig.motor
  const speed = Math.abs(wheelSpeed)
  const curve = Math.max(0, m.stallTorque * (1 - speed / m.freeSpeed))
  const power = speed > 1e-3 ? m.powerLimit / speed : Infinity
  const total = Math.min(curve, power) * Math.max(0, Math.min(1, throttle))
  return reverse ? -total * m.reverseFactor : total
}
