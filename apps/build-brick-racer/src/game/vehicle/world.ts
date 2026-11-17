import type RAPIER from '@dimforge/rapier3d-compat'
import type { EnvironmentDefinition, StaticBox } from '../env/types'
import type { Q4, V3 } from '../math'
import type { SurfaceId } from './physics-config'
import type { Rapier } from './rapier'
import { physicsConfig } from './physics-config'

/** A Rapier world built from authored environment boxes. Surface ids are looked up per collider. */
export class PhysicsWorld {
  readonly world: RAPIER.World
  readonly surfaceOf = new Map<number, SurfaceId>()
  readonly kindOf = new Map<number, StaticBox['kind']>()

  constructor(readonly rapier: Rapier, readonly env: EnvironmentDefinition) {
    this.world = new rapier.World({ x: 0, y: -physicsConfig.gravity, z: 0 })
    this.world.timestep = 1 / (physicsConfig.tickHz * physicsConfig.substeps)
    for (const box of env.boxes) this.addBox(box)
    // Scene queries (ray casts, shape casts) see colliders only after the pipeline has stepped once.
    this.world.step()
  }

  private addBox(box: StaticBox): void {
    const R = this.rapier
    const desc = R.ColliderDesc.cuboid(box.half[0], box.half[1], box.half[2])
      .setTranslation(box.centre[0], box.centre[1], box.centre[2])
      .setFriction(box.kind === 'ground' ? 0.7 : 0.35)
      .setRestitution(0.05)
    if (box.rot)
      desc.setRotation({ x: box.rot[0], y: box.rot[1], z: box.rot[2], w: box.rot[3] })
    const collider = this.world.createCollider(desc)
    this.surfaceOf.set(collider.handle, box.surface)
    this.kindOf.set(collider.handle, box.kind)
  }

  /** Highest drivable surface at x,z below `fromY`. */
  groundAt(x: number, z: number, fromY = 40): { y: number, normal: V3, surface: SurfaceId } | null {
    const hit = this.world.castRayAndGetNormal(new this.rapier.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 }), fromY + 20, true)
    if (!hit)
      return null
    return {
      y: fromY - hit.timeOfImpact,
      normal: [hit.normal.x, hit.normal.y, hit.normal.z],
      surface: this.surfaceOf.get(hit.collider.handle) ?? 'tile',
    }
  }

  /** True when an oriented box overlaps no static geometry. */
  boxIsClear(centre: V3, half: V3, rot: Q4): boolean {
    const R = this.rapier
    const shape = new R.Cuboid(half[0], half[1], half[2])
    const hit = this.world.intersectionWithShape(
      { x: centre[0], y: centre[1], z: centre[2] },
      { x: rot[0], y: rot[1], z: rot[2], w: rot[3] },
      shape,
    )
    return hit === null
  }

  dispose(): void {
    this.world.free()
  }
}
