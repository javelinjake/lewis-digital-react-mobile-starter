/**
 * Mirror placement. The mirrored piece is found by matching real geometry: the mirror image of the
 * original piece (boxes and connectors) must equal some allowed placement of the part (or its
 * left/right counterpart). Chiral parts without a counterpart cannot be mirrored.
 */
import type { PartDefinition } from '../catalog/types'
import type { Rot, V3I } from '../lattice'
import type { PlacementCandidate } from './candidates'
import type { EditContext } from './doc'
import type { PlacedPart } from './geometry'
import type { CarDocument } from './types'
import { rotBox, unionBox } from '../lattice'
import { boundsOf, placeAll, placeDefinition } from './geometry'

export interface MirroredPlacement {
  defId: string
  pos: V3I
  rot: Rot
  /** True when the piece sits on the plane and is its own mirror image. */
  onPlane: boolean
}

type Geometry = Pick<PlacedPart, 'boxes' | 'connectors'>

const connectorSig = (c: Geometry['connectors'][number]) => `${c.type}:${c.pos2.join(',')}:${c.dir.join(',')}`
const boxSig = (b: Geometry['boxes'][number]) => `${b.min.join(',')}-${b.max.join(',')}`

function signature(g: Geometry): string {
  return `${g.boxes.map(boxSig).sort().join(';')}#${g.connectors.map(connectorSig).sort().join(';')}`
}

function mirrorGeometry(g: Geometry, plane2: number): Geometry {
  return {
    boxes: g.boxes.map(b => ({
      min: [plane2 - b.max[0], b.min[1], b.min[2]] as V3I,
      max: [plane2 - b.min[0], b.max[1], b.max[2]] as V3I,
    })),
    connectors: g.connectors.map(c => ({
      ...c,
      pos2: [2 * plane2 - c.pos2[0], c.pos2[1], c.pos2[2]] as V3I,
      dir: [-c.dir[0], c.dir[1], c.dir[2]] as V3I,
    })),
  }
}

/** Doubled X of a default mirror plane through the middle of the main assembly. */
export function defaultMirrorPlane2(doc: CarDocument, ctx: EditContext): number {
  const placed = placeAll(doc.instances, ctx.catalog).placed
  const bounds = boundsOf(placed)
  return bounds ? bounds.min[0] + bounds.max[0] : 0
}

/** The mirror image of a placement across the plane, or null when none exists in the catalogue. */
export function mirrorPlacement(
  placement: Pick<PlacementCandidate, 'defId' | 'pos' | 'rot'>,
  plane2: number,
  ctx: EditContext,
): MirroredPlacement | null {
  const def = ctx.catalog.get(placement.defId)
  if (!def || def.mirror === null)
    return null
  const original = placeDefinition(def, placement.pos, placement.rot)
  const target = mirrorGeometry(original, plane2)
  const targetSig = signature(target)
  const wanted = unionBox(target.boxes)!

  const counterpartId = def.mirror === 'self' ? def.id : def.mirror
  const counterpart: PartDefinition | undefined = ctx.catalog.get(counterpartId)
  if (!counterpart)
    return null

  for (const rot of counterpart.allowedRotations) {
    const local = unionBox(counterpart.boxes.map(b => rotBox(b, counterpart.size, rot)))!
    const pos: V3I = [wanted.min[0] - local.min[0], wanted.min[1] - local.min[1], wanted.min[2] - local.min[2]]
    const candidate = placeDefinition(counterpart, pos, rot)
    if (signature(candidate) === targetSig) {
      const onPlane = counterpart.id === def.id && rot === placement.rot
        && pos[0] === placement.pos[0] && pos[1] === placement.pos[1] && pos[2] === placement.pos[2]
      return { defId: counterpart.id, pos, rot, onPlane }
    }
  }
  return null
}
