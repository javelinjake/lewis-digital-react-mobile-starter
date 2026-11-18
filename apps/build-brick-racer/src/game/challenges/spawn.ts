import type RAPIER from '@dimforge/rapier3d-compat'
import type { Q4, V3 } from '../math'
import type { VehicleSpec } from '../vehicle/compile'
import type { Pose } from '../vehicle/sim'
import type { PhysicsWorld } from '../vehicle/world'
import type { ChallengeDefinition } from './types'
import { qFromYaw, qRotate } from '../math'

/** Distance the car's wheels start above the ground so it settles instead of intersecting. */
const DROP = 0.03

/** A pose that puts the car's wheels on the ground under (x, z). Null when there is no ground. */
export function poseOnGround(pw: PhysicsWorld, spec: VehicleSpec, x: number, z: number, yaw: number, fromY = 12): Pose | null {
  const ground = pw.groundAt(x, z, fromY)
  if (!ground)
    return null
  return { pos: [x, ground.y - spec.wheelBottomY + DROP, z], yaw }
}

/** Whether the car's body fits the challenge's spawn volume. Reports the limitation so the UI can offer free drive. */
export function fitsSpawn(def: ChallengeDefinition, spec: VehicleSpec): { fits: boolean, reason?: string } {
  const z = def.spawnClearance
  const halfWidth = spec.size[0] / 2
  const halfLength = spec.size[2] / 2
  if (halfWidth > z.half[0] || halfLength > z.half[2] || spec.size[1] > z.half[1] * 2) {
    return { fits: false, reason: 'This car is too big for the start area of this challenge.' }
  }
  return { fits: true }
}

function clear(pw: PhysicsWorld, spec: VehicleSpec, pose: Pose, body?: RAPIER.RigidBody): boolean {
  const q: Q4 = qFromYaw(pose.yaw)
  const half: V3 = [spec.size[0] / 2 + 0.03, spec.size[1] / 2, spec.size[2] / 2 + 0.03]
  // Bounds are relative to the centre of mass, so offset to the geometric centre and turn with the car.
  const mid: V3 = [(spec.bounds.min[0] + spec.bounds.max[0]) / 2, (spec.bounds.min[1] + spec.bounds.max[1]) / 2, (spec.bounds.min[2] + spec.bounds.max[2]) / 2]
  const turned = qRotate(q, mid)
  const centre: V3 = [pose.pos[0] + turned[0], pose.pos[1] + turned[1] + 0.1, pose.pos[2] + turned[2]]
  return pw.boxIsClear(centre, half, q, body)
}

export function startPose(def: ChallengeDefinition, pw: PhysicsWorld, spec: VehicleSpec): Pose | null {
  return poseOnGround(pw, spec, def.start.position[0], def.start.position[2], def.start.yaw)
}

/**
 * Safe pose for a reset: the last checkpoint with enough clearance for the car (trying a few
 * lateral offsets), else the course start.
 */
export function resetPose(
  def: ChallengeDefinition,
  checkpoint: { pos: V3, yaw: number } | null,
  pw: PhysicsWorld,
  spec: VehicleSpec,
  body?: RAPIER.RigidBody,
): Pose | null {
  if (checkpoint) {
    const lateral: V3 = [Math.cos(checkpoint.yaw), 0, -Math.sin(checkpoint.yaw)]
    for (const offset of [0, 0.9, -0.9, 1.8, -1.8]) {
      const pose = poseOnGround(pw, spec, checkpoint.pos[0] + lateral[0] * offset, checkpoint.pos[2] + lateral[2] * offset, checkpoint.yaw)
      if (pose && clear(pw, spec, pose, body))
        return pose
    }
  }
  return startPose(def, pw, spec)
}

/** Open-floor free drive spawn. */
export function freeDrivePose(pw: PhysicsWorld, spec: VehicleSpec, place: { position: V3, yaw: number }): Pose | null {
  return poseOnGround(pw, spec, place.position[0], place.position[2], place.yaw)
}
