/**
 * Integer lattice transforms. Parts snap to a lattice (X/Z in studs, Y in plates)
 * and rotate in right-angle yaw steps about the vertical axis. Connector points
 * are stored in doubled coordinates so stud centres and axle mid-points stay integers.
 *
 * Quarter-turn convention: turn k maps local +X to world:
 *   k0 +X, k1 +Z, k2 -X, k3 -Z   (and local +Z to -X for k1, etc.)
 */
export type V3I = readonly [number, number, number]
export type Rot = 0 | 1 | 2 | 3
export const ROTATIONS: readonly Rot[] = [0, 1, 2, 3]

export interface BoxI {
  min: V3I
  max: V3I
}

export const addI = (a: V3I, b: V3I): V3I => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const subI = (a: V3I, b: V3I): V3I => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const eqI = (a: V3I, b: V3I): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
export const keyI = (a: V3I): string => `${a[0]},${a[1]},${a[2]}`

export const normRot = (k: number): Rot => (((k % 4) + 4) % 4) as Rot

/** Bounding size of a part after rotation. */
export function rotatedSize(size: V3I, k: Rot): V3I {
  return k % 2 === 0 ? size : [size[2], size[1], size[0]]
}

/** Rotate a doubled-coordinate point inside a part whose local size is `size` (undoubled). */
export function rotPoint2(p: V3I, size: V3I, k: Rot): V3I {
  const sx2 = size[0] * 2
  const sz2 = size[2] * 2
  switch (k) {
    case 0: return p
    case 1: return [sz2 - p[2], p[1], p[0]]
    case 2: return [sx2 - p[0], p[1], sz2 - p[2]]
    default: return [p[2], p[1], sx2 - p[0]]
  }
}

/** Rotate a real-valued lattice point (used by rendering). */
export function rotPointReal(p: readonly [number, number, number], size: V3I, k: Rot): [number, number, number] {
  switch (k) {
    case 0: return [p[0], p[1], p[2]]
    case 1: return [size[2] - p[2], p[1], p[0]]
    case 2: return [size[0] - p[0], p[1], size[2] - p[2]]
    default: return [p[2], p[1], size[0] - p[0]]
  }
}

/** Rotate a direction vector. */
export function rotDir(d: V3I, k: Rot): V3I {
  switch (k) {
    case 0: return d
    case 1: return [-d[2], d[1], d[0]]
    case 2: return [-d[0], d[1], -d[2]]
    default: return [d[2], d[1], -d[0]]
  }
}

/** Rotate a real-valued direction (rendering normals). */
export function rotDirReal(d: readonly [number, number, number], k: Rot): [number, number, number] {
  switch (k) {
    case 0: return [d[0], d[1], d[2]]
    case 1: return [-d[2], d[1], d[0]]
    case 2: return [-d[0], d[1], -d[2]]
    default: return [d[2], d[1], -d[0]]
  }
}

/** Box in local lattice coordinates to its rotated box (still with min corner relative to the rotated bounds). */
export function rotBox(b: BoxI, size: V3I, k: Rot): BoxI {
  const lo = rotPoint2([b.min[0] * 2, b.min[1] * 2, b.min[2] * 2], size, k)
  const hi = rotPoint2([b.max[0] * 2, b.max[1] * 2, b.max[2] * 2], size, k)
  return {
    min: [Math.min(lo[0], hi[0]) / 2, Math.min(lo[1], hi[1]) / 2, Math.min(lo[2], hi[2]) / 2],
    max: [Math.max(lo[0], hi[0]) / 2, Math.max(lo[1], hi[1]) / 2, Math.max(lo[2], hi[2]) / 2],
  }
}

export function offsetBox(b: BoxI, by: V3I): BoxI {
  return { min: addI(b.min, by), max: addI(b.max, by) }
}

/** True when two boxes share interior volume. Touching faces do not overlap. */
export function boxesOverlap(a: BoxI, b: BoxI): boolean {
  return a.min[0] < b.max[0] && a.max[0] > b.min[0]
    && a.min[1] < b.max[1] && a.max[1] > b.min[1]
    && a.min[2] < b.max[2] && a.max[2] > b.min[2]
}

export function unionBox(boxes: readonly BoxI[]): BoxI | null {
  if (boxes.length === 0)
    return null
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.min[0])
    minY = Math.min(minY, b.min[1])
    minZ = Math.min(minZ, b.min[2])
    maxX = Math.max(maxX, b.max[0])
    maxY = Math.max(maxY, b.max[1])
    maxZ = Math.max(maxZ, b.max[2])
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
}

/** Mirror a doubled-coordinate point across the plane x2 = plane2 (plane2 is the doubled X of the plane). */
export const mirrorX2 = (p: V3I, plane2: number): V3I => [2 * plane2 - p[0], p[1], p[2]]
