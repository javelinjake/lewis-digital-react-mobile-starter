import type RAPIER from '@dimforge/rapier3d-compat'
/**
 * Live camera rigs. Pure logic: the render layer applies the returned pose to its camera. Steering is always
 * vehicle-relative; these rigs never swing in front of the car or reverse the view, and never roll.
 */
import type { V3 } from '../math'
import type { VehicleState } from '../vehicle/sim'
import type { PhysicsWorld } from '../vehicle/world'
import { add, clamp, length, lerp, lerp3, qRotate, scale, sub, wrapAngle } from '../math'

export interface CameraPose {
  position: V3
  target: V3
  fov: number
}

export type LiveCameraMode = 'chase' | 'close' | 'high'

/** Distances are in units of the car's size `u`, so large cars and wings stay in frame. */
export interface RigPreset {
  back: number
  up: number
  look: number
  fov: number
  /** Smoothing time constant, seconds. */
  tau: number
}

export const RIG_PRESETS: Record<LiveCameraMode, RigPreset> = {
  chase: { back: 3.0, up: 1.15, look: 1.0, fov: 58, tau: 0.22 },
  close: { back: 1.9, up: 0.65, look: 1.4, fov: 66, tau: 0.16 },
  high: { back: 3.2, up: 2.9, look: 0.6, fov: 56, tau: 0.3 },
}

export function mixPreset(a: RigPreset, b: RigPreset, t: number): RigPreset {
  return {
    back: lerp(a.back, b.back, t),
    up: lerp(a.up, b.up, t),
    look: lerp(a.look, b.look, t),
    fov: lerp(a.fov, b.fov, t),
    tau: lerp(a.tau, b.tau, t),
  }
}

export interface RigOptions {
  /** Whole-car bounds in metres (width, height, length), including wings and tall structures. */
  carSize: V3
  /** Reduced motion: no speed pull-back and slower smoothing. */
  reducedMotion: boolean
}

export interface RigContext {
  preset: RigPreset
  world?: PhysicsWorld | null
  excludeBody?: RAPIER.RigidBody | null
}

export class CameraRig {
  private yaw = 0
  private position: V3 = [0, 0, 0]
  private target: V3 = [0, 0, 0]
  private fov = 58
  private primed = false
  /** How much the last frame had to pull the camera in to clear an obstacle, 0..1. */
  obstruction = 0
  readonly unit: number

  constructor(private readonly opts: RigOptions) {
    const [w, h, l] = opts.carSize
    this.unit = Math.max(0.5, l, w * 1.4, h * 1.2)
  }

  /** Jump to the ideal pose (after a reset or when the run starts). */
  snap(): void {
    this.primed = false
  }

  update(state: VehicleState, dt: number, ctx: RigContext): CameraPose {
    const u = this.unit
    const p = ctx.preset
    const fwd = qRotate(state.quat, [0, 0, 1])
    const yawTarget = Math.atan2(fwd[0], fwd[2])
    const tau = p.tau * (this.opts.reducedMotion ? 1.6 : 1)
    const k = this.primed ? 1 - Math.exp(-dt / tau) : 1
    this.yaw += wrapAngle(yawTarget - this.yaw) * k

    const pull = this.opts.reducedMotion ? 0 : Math.min(0.25, state.speed * 0.03)
    const back = p.back * u * (1 + pull)
    const behind: V3 = [-Math.sin(this.yaw), 0, -Math.cos(this.yaw)]
    const anchor: V3 = [state.pos[0], state.pos[1] + 0.15 * u, state.pos[2]]
    let desired = add(add(anchor, scale(behind, back)), [0, p.up * u, 0])

    // Keep the car visible: pull the camera toward the car if something is in the way.
    this.obstruction = 0
    if (ctx.world && ctx.excludeBody) {
      const dir = sub(desired, anchor)
      const dist = length(dir)
      if (dist > 1e-3) {
        const R = ctx.world.rapier
        const hit = ctx.world.world.castRay(
          new R.Ray({ x: anchor[0], y: anchor[1], z: anchor[2] }, { x: dir[0] / dist, y: dir[1] / dist, z: dir[2] / dist }),
          dist,
          true,
          undefined,
          undefined,
          undefined,
          ctx.excludeBody,
        )
        if (hit) {
          const safe = Math.max(0.8 * u, hit.timeOfImpact - 0.25 * u)
          this.obstruction = clamp(1 - safe / dist, 0, 1)
          desired = add(anchor, scale(dir, safe / dist))
        }
      }
    }
    // Never dip below the ground the car stands on.
    desired = [desired[0], Math.max(desired[1], state.pos[1] - 0.2 * u + 0.15), desired[2]]

    const lookAt: V3 = add(add(anchor, scale(fwd, p.look * u * 0.5)), [0, 0, 0])
    this.position = this.primed ? lerp3(this.position, desired, k) : desired
    this.target = this.primed ? lerp3(this.target, lookAt, 1 - Math.exp(-dt / (tau * 0.6))) : lookAt
    this.fov = this.primed ? lerp(this.fov, p.fov, k) : p.fov
    this.primed = true
    return { position: this.position, target: this.target, fov: this.fov }
  }
}
