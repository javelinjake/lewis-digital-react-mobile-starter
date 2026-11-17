/** Find a free spot beside the car for a part that is placed loose (Free Build keeps unfinished work). */
import type { CarDocument } from '@/game/build/types'
import type { PartDefinition } from '@/game/catalog/types'
import type { Rot, V3I } from '@/game/lattice'
import { defaultContext } from '@/game/build/doc'
import { boundsOf, BoxIndex, placeAll, placeDefinition } from '@/game/build/geometry'
import { overlappingParts } from '@/game/build/validate'
import { rotatedSize } from '@/game/lattice'

/** Positions are searched outward from the car's right-hand side, never overlapping anything. */
export function findLoosePosition(doc: CarDocument, def: PartDefinition, rot: Rot): V3I {
  const placed = placeAll(doc.instances, defaultContext.catalog).placed
  const bounds = boundsOf(placed)
  if (!bounds)
    return [0, 0, 0]
  const index = new BoxIndex(placed)
  const [sx, , sz] = rotatedSize(def.size, rot)
  const baseX = bounds.max[0] + 2
  const baseZ = bounds.min[2]
  for (let ring = 0; ring < 30; ring++) {
    for (const dz of [0, sz + 1, -(sz + 1)]) {
      const pos: V3I = [baseX + ring * (sx + 1), 0, baseZ + dz]
      if (overlappingParts(placeDefinition(def, pos, rot), index).length === 0)
        return pos
    }
  }
  return [baseX + 40, 0, baseZ]
}
