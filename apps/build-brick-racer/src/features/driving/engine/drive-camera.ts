import type RAPIER from '@dimforge/rapier3d-compat'
import type { PerspectiveCamera } from 'three'
import type { RigPreset } from '@/game/camera/rig'
import type { CameraVolume } from '@/game/env/types'
import type { CameraChoice } from '@/game/persistence/types'
import type { VehicleSpec } from '@/game/vehicle/compile'
import type { VehicleState } from '@/game/vehicle/sim'
import type { PhysicsWorld } from '@/game/vehicle/world'
import { CameraRig, RIG_PRESETS } from '@/game/camera/rig'
import { SmartDirector } from '@/game/camera/smart'
import { qRotate } from '@/game/math'

/**
 * Phone-sized screens need the car larger in frame than the shared presets give, so every live camera is brought
 * in a little. The shared presets in game/camera stay untouched.
 */
export const tunePreset = (p: RigPreset): RigPreset => ({ ...p, back: p.back * 0.74, up: p.up * 0.8, look: p.look * 0.9 })

export const CAMERA_ORDER: readonly CameraChoice[] = ['chase', 'close', 'high', 'smart']

/**
 * Live camera: chase, close and high rigs plus the optional smart director. Steering stays vehicle-relative in
 * every mode because the rig only follows the car's heading and never reverses or rolls the view.
 */
export class DriveCamera {
  readonly rig: CameraRig
  readonly director: SmartDirector
  mode: CameraChoice
  private steer = 0
  private sinceCollision = 99
  private hazard = 99
  private hazardClock = 0

  constructor(
    spec: VehicleSpec,
    volumes: readonly CameraVolume[],
    mode: CameraChoice,
    lock: boolean,
    reducedMotion: boolean,
  ) {
    this.rig = new CameraRig({ carSize: spec.size, reducedMotion })
    this.director = new SmartDirector(volumes, 'chase')
    this.director.setLock(lock)
    this.mode = mode
  }

  get locked(): boolean {
    return this.director.locked
  }

  setLock(lock: boolean): void {
    this.director.setLock(lock)
  }

  cycle(): CameraChoice {
    this.mode = CAMERA_ORDER[(CAMERA_ORDER.indexOf(this.mode) + 1) % CAMERA_ORDER.length]!
    return this.mode
  }

  snap(): void {
    this.rig.snap()
    this.sinceCollision = 99
  }

  noteSteer(magnitude: number): void {
    this.steer += (Math.min(1, Math.abs(magnitude)) - this.steer) * 0.2
  }

  noteCollision(): void {
    this.sinceCollision = 0
  }

  private scanHazard(state: VehicleState, pw: PhysicsWorld, body: RAPIER.RigidBody): void {
    const fwd = qRotate(state.quat, [0, 0, 1])
    const R = pw.rapier
    const hit = pw.world.castRay(
      new R.Ray({ x: state.pos[0], y: state.pos[1] + 0.1, z: state.pos[2] }, { x: fwd[0], y: 0, z: fwd[2] }),
      6,
      true,
      undefined,
      undefined,
      undefined,
      body,
    )
    this.hazard = hit ? hit.timeOfImpact : 99
  }

  /** Update the rig and apply the pose to the three.js camera. */
  update(camera: PerspectiveCamera, state: VehicleState, dt: number, pw: PhysicsWorld, body: RAPIER.RigidBody): void {
    this.sinceCollision += dt
    this.hazardClock += dt
    if (this.hazardClock > 0.15) {
      this.hazardClock = 0
      this.scanHazard(state, pw, body)
    }
    const preset = this.mode === 'smart'
      ? this.director.update(dt, {
          state,
          steer: this.steer,
          sinceCollision: this.sinceCollision,
          hazardAhead: this.hazard,
          obstruction: this.rig.obstruction,
        })
      : RIG_PRESETS[this.mode]
    const pose = this.rig.update(state, dt, { preset: tunePreset(preset), world: pw, excludeBody: body })
    camera.position.set(pose.position[0], pose.position[1], pose.position[2])
    camera.lookAt(pose.target[0], pose.target[1], pose.target[2])
    if (Math.abs(camera.fov - pose.fov) > 0.01) {
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
    }
  }
}
