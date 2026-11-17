import type { PartDefinition } from '../catalog/types'
import type { Rot, V3I } from '../lattice'
import type { EditContext } from './doc'
import type { WorldConnector } from './geometry'
import type { CarDocument, Forward } from './types'
import { MATING_TYPE } from '../catalog/types'
import { keyI, normRot, rotDir, rotPoint2 } from '../lattice'
import { connectorKey, occupiedConnectorKeys, tagsOverlap } from './connections'
import { BoxIndex, placeAll, placeDefinition } from './geometry'
import { overlappingParts } from './validate'

export interface PlacementCandidate {
  defId: string
  pos: V3I
  rot: Rot
  /** Lattice point the part snaps to (undoubled, may be half-integers). */
  anchor: readonly [number, number, number]
  anchorKind: 'stud' | 'socket' | 'axle'
  /** How many connections the placement makes. More is a more natural default. */
  connections: number
  key: string
}

export interface CandidateOptions {
  rotations: readonly Rot[]
  /** Keep only candidates anchored on the main assembly's open connectors. */
  limit?: number
}

/** Rotation that runs the part's long side along the car's forward axis. */
export function defaultRotation(def: PartDefinition, forward: Forward): Rot {
  const [sx, , sz] = def.size
  const alongZ = forward === 'z+' || forward === 'z-'
  if (def.wheel)
    return 0
  if (alongZ)
    return sx > sz ? 1 : 0
  return sz > sx ? 1 : 0
}

export function rotationsFor(def: PartDefinition, selected: Rot): Rot[] {
  // Wheels auto-orient to whichever side of a mount or axle they are offered.
  if (def.wheel)
    return def.allowedRotations.slice()
  return def.allowedRotations.includes(selected) ? [selected] : [def.allowedRotations[0] ?? 0]
}

/**
 * Every lattice-exact, overlap-free way to attach `def` to an open connector of the car.
 * Used for the highlighted spots in Easy Build and for snapping in Free Build.
 */
export function findPlacements(doc: CarDocument, def: PartDefinition, opts: CandidateOptions, ctx: EditContext): PlacementCandidate[] {
  const set = placeAll(doc.instances, ctx.catalog)
  const index = new BoxIndex(set.placed)
  const occupied = occupiedConnectorKeys(doc.connections)

  const anchorsByType = new Map<string, WorldConnector[]>()
  const openKeys = new Set<string>()
  for (const p of set.placed) {
    for (const c of p.connectors) {
      if (occupied.has(`${c.instanceId}:${c.connectorId}`))
        continue
      openKeys.add(connectorKey(c))
      const list = anchorsByType.get(c.type)
      if (list)
        list.push(c)
      else
        anchorsByType.set(c.type, [c])
    }
  }

  const seen = new Map<string, PlacementCandidate>()
  for (const rot of opts.rotations) {
    for (const d of def.connectors) {
      const anchors = anchorsByType.get(MATING_TYPE[d.type])
      if (!anchors)
        continue
      const worldDir = rotDir(d.dir, rot)
      const local = rotPoint2(d.pos2, def.size, rot)
      for (const a of anchors) {
        if (a.dir[0] !== -worldDir[0] || a.dir[1] !== -worldDir[1] || a.dir[2] !== -worldDir[2])
          continue
        if (!tagsOverlap(a.tags, d.tags))
          continue
        const px = a.pos2[0] - local[0]
        const py = a.pos2[1] - local[1]
        const pz = a.pos2[2] - local[2]
        if (px % 2 !== 0 || py % 2 !== 0 || pz % 2 !== 0)
          continue
        const pos: V3I = [px / 2, py / 2, pz / 2]
        const key = `${def.id}|${keyI(pos)}|${rot}`
        if (seen.has(key))
          continue
        const placed = placeDefinition(def, pos, rot)
        if (overlappingParts(placed, index).length > 0)
          continue
        let connections = 0
        for (const c of placed.connectors) {
          if (openKeys.has(connectorKey(c, MATING_TYPE[c.type], true)))
            connections += 1
        }
        if (connections === 0)
          continue
        seen.set(key, {
          defId: def.id,
          pos,
          rot: normRot(rot),
          anchor: [a.pos2[0] / 2, a.pos2[1] / 2, a.pos2[2] / 2],
          anchorKind: a.type === 'stud' ? 'stud' : a.type === 'socket' ? 'socket' : 'axle',
          connections,
          key,
        })
      }
    }
  }

  const out = [...seen.values()].sort((a, b) => b.connections - a.connections || (a.key < b.key ? -1 : 1))
  return opts.limit ? out.slice(0, opts.limit) : out
}

/** Group candidates by their anchor point so the editor draws one marker per spot. */
export function groupByAnchor(candidates: readonly PlacementCandidate[]): Map<string, PlacementCandidate[]> {
  const groups = new Map<string, PlacementCandidate[]>()
  for (const c of candidates) {
    const key = c.anchor.join(',')
    const list = groups.get(key)
    if (list)
      list.push(c)
    else
      groups.set(key, [c])
  }
  return groups
}
