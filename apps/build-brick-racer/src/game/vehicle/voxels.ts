import type { BoxI } from '../lattice'
import { UNITS } from '../units'

const key = (x: number, y: number, z: number) => `${x},${y},${z}`

/** Rasterise integer lattice boxes into a voxel set (1 stud x 1 plate x 1 stud). */
export function voxelise(boxes: readonly BoxI[]): Set<string> {
  const set = new Set<string>()
  for (const b of boxes) {
    for (let x = b.min[0]; x < b.max[0]; x++) {
      for (let y = b.min[1]; y < b.max[1]; y++) {
        for (let z = b.min[2]; z < b.max[2]; z++) set.add(key(x, y, z))
      }
    }
  }
  return set
}

/**
 * Greedy merge of occupied voxels into a small set of axis-aligned boxes. Keeps the physics
 * collider count bounded for large builds while staying exact for the occupied volume.
 */
export function mergeVoxelBoxes(boxes: readonly BoxI[]): BoxI[] {
  const occupied = voxelise(boxes)
  const visited = new Set<string>()
  const cells = [...occupied].map(k => k.split(',').map(Number) as [number, number, number])
  cells.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2])
  const free = (x: number, y: number, z: number) => occupied.has(key(x, y, z)) && !visited.has(key(x, y, z))
  const out: BoxI[] = []

  for (const [x, y, z] of cells) {
    if (visited.has(key(x, y, z)))
      continue
    let x1 = x
    while (free(x1 + 1, y, z)) x1 += 1
    let z1 = z
    const rowFree = (zz: number) => {
      for (let xx = x; xx <= x1; xx++) {
        if (!free(xx, y, zz))
          return false
      }
      return true
    }
    while (rowFree(z1 + 1)) z1 += 1
    let y1 = y
    const slabFree = (yy: number) => {
      for (let xx = x; xx <= x1; xx++) {
        for (let zz = z; zz <= z1; zz++) {
          if (!free(xx, yy, zz))
            return false
        }
      }
      return true
    }
    while (slabFree(y1 + 1)) y1 += 1
    for (let xx = x; xx <= x1; xx++) {
      for (let yy = y; yy <= y1; yy++) {
        for (let zz = z; zz <= z1; zz++) visited.add(key(xx, yy, zz))
      }
    }
    out.push({ min: [x, y, z], max: [x1 + 1, y1 + 1, z1 + 1] })
  }
  // Part boxes never overlap structurally, so they are already an exact cover. Keep whichever list is smaller.
  return out.length < boxes.length ? out : [...boxes]
}

/**
 * Exposed frontal, side and top area from the occupancy silhouette. Each projected cell counts once,
 * so pieces hidden behind others add nothing.
 */
export function projectedArea(
  boxes: readonly BoxI[],
  voxel: (x: number, y: number, z: number) => [number, number, number],
): { front: number, side: number, top: number } {
  const front = new Set<string>()
  const side = new Set<string>()
  const top = new Set<string>()
  for (const k of voxelise(boxes)) {
    const [x, y, z] = k.split(',').map(Number) as [number, number, number]
    const [lat, h, fwd] = voxel(x, y, z)
    front.add(`${lat},${h}`)
    side.add(`${fwd},${h}`)
    top.add(`${lat},${fwd}`)
  }
  return {
    front: front.size * UNITS.studM * UNITS.plateM,
    side: side.size * UNITS.studM * UNITS.plateM,
    top: top.size * UNITS.studM * UNITS.studM,
  }
}
