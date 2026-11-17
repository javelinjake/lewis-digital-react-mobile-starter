import { physicsConfig } from './physics-config'

/** Player intent for one physics tick. Every value comes from the player's controls. */
export interface DriveInput {
  /** -1 left .. +1 right. */
  steer: number
  throttle: number
  brake: number
  /** Deliberate reverse: throttle drives backwards. */
  reverse: boolean
}

export const NO_INPUT: DriveInput = { steer: 0, throttle: 0, brake: 0, reverse: false }

/** Raw control state: digital buttons or analogue values. */
export interface RawControls {
  left: boolean
  right: boolean
  /** Analogue steering from a thumb pad, -1..1, wins over buttons when non-zero. */
  steerAxis: number
  throttle: boolean
  throttleAxis: number
  brake: boolean
  brakeAxis: number
  reverse: boolean
}

export function emptyControls(): RawControls {
  return {
    left: false,
    right: false,
    steerAxis: 0,
    throttle: false,
    throttleAxis: 0,
    brake: false,
    brakeAxis: 0,
    reverse: false,
  }
}

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v))

/** Smooths digital buttons into continuous values. Sampled once per physics tick. */
export class InputRamp {
  private steer = 0
  private throttle = 0
  private brake = 0

  reset(): void {
    this.steer = 0
    this.throttle = 0
    this.brake = 0
  }

  sample(raw: RawControls, dt: number): DriveInput {
    const s = physicsConfig.steering
    const targetSteer = raw.steerAxis !== 0 ? raw.steerAxis : (raw.right ? 1 : 0) - (raw.left ? 1 : 0)
    const rate = (Math.abs(targetSteer) > Math.abs(this.steer) && Math.sign(targetSteer) === Math.sign(this.steer || targetSteer)) ? s.rampUp : s.rampDown
    this.steer = approach(this.steer, targetSteer, rate * dt)
    this.throttle = approach(this.throttle, raw.throttleAxis > 0 ? raw.throttleAxis : raw.throttle ? 1 : 0, (raw.throttle || raw.throttleAxis > 0 ? 4 : 8) * dt)
    this.brake = approach(this.brake, raw.brakeAxis > 0 ? raw.brakeAxis : raw.brake ? 1 : 0, (raw.brake || raw.brakeAxis > 0 ? 8 : 12) * dt)
    return { steer: clampUnit(this.steer), throttle: clampUnit(this.throttle), brake: clampUnit(this.brake), reverse: raw.reverse }
  }
}

function approach(value: number, target: number, step: number): number {
  if (value < target)
    return Math.min(target, value + step)
  return Math.max(target, value - step)
}
