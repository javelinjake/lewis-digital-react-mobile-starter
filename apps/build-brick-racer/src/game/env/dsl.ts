/** Tiny authoring helpers for environment boxes. Distances are game metres. */
import type { Q4, V3 } from '../math'
import type { SurfaceId } from '../vehicle/physics-config'
import type { BoxKind, StaticBox } from './types'
import { add, cross, length, normalize, qFromEuler, qRotate, scale, sub } from '../math'

type Look = NonNullable<StaticBox['look']>

export function flat(id: string, x0: number, x1: number, z0: number, z1: number, yTop: number, surface: SurfaceId, look: Look, thick = 1): StaticBox {
  return {
    id,
    centre: [(x0 + x1) / 2, yTop - thick / 2, (z0 + z1) / 2],
    half: [(x1 - x0) / 2, thick / 2, (z1 - z0) / 2],
    surface,
    kind: 'ground',
    look,
  }
}

/** Axis-aligned solid between two corners. Walls and props use this. */
export function solid(id: string, min: V3, max: V3, kind: BoxKind, surface: SurfaceId, look: Look): StaticBox {
  return {
    id,
    centre: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    half: [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2],
    surface,
    kind,
    look,
  }
}

/** Orientation for a slab whose local +Z runs from `from` to `to`, upright (no roll). */
function slabRotation(from: V3, to: V3): { q: Q4, run: number, normal: V3 } {
  const d = sub(to, from)
  const horizontal = Math.hypot(d[0], d[2])
  const yaw = Math.atan2(d[0], d[2])
  // Positive pitch tilts +Z downhill.
  const pitch = Math.atan2(-d[1], horizontal)
  const q = qFromEuler(pitch, yaw)
  return { q, run: length(d), normal: qRotate(q, [0, 1, 0]) }
}

/** An inclined drivable slab whose top surface runs from `from` to `to` (points on the surface centre line). */
export function ramp(id: string, from: V3, to: V3, width: number, thick: number, surface: SurfaceId, look: Look): StaticBox {
  const { q, run, normal } = slabRotation(from, to)
  const mid = scale(add(from, to), 0.5)
  return {
    id,
    centre: sub(mid, scale(normal, thick / 2)),
    half: [width / 2, thick / 2, run / 2],
    rot: q,
    surface,
    kind: 'ground',
    look,
  }
}

/** A low wall following a ramp edge, `offset` metres to the side of the centre line. */
export function rail(id: string, from: V3, to: V3, offset: number, height: number, look: Look, thick = 0.2): StaticBox {
  const { q, run, normal } = slabRotation(from, to)
  const side = normalize(cross(normal, normalize(sub(to, from))))
  const mid = add(scale(add(from, to), 0.5), scale(side, offset))
  return {
    id,
    centre: add(mid, scale(normal, height / 2)),
    half: [thick / 2, height / 2, run / 2],
    rot: q,
    surface: 'plastic',
    kind: 'wall',
    look,
  }
}
