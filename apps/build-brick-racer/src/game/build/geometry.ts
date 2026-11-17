import type { PartCatalog } from '../catalog/catalog'
import type { ConnectorType, PartDefinition } from '../catalog/types'
import type { BoxI, Rot, V3I } from '../lattice'
import type { PartInstance } from './types'
import { addI, offsetBox, rotatedSize, rotBox, rotDir, rotPoint2, unionBox } from '../lattice'

export interface WorldConnector {
  instanceId: string
  connectorId: string
  type: ConnectorType
  /** Doubled world lattice coordinates. */
  pos2: V3I
  dir: V3I
  tags: readonly string[]
}

export interface PlacedPart {
  instance: PartInstance
  def: PartDefinition
  /** Structural boxes in world lattice coordinates. */
  boxes: BoxI[]
  /** Rotated bounding box (world). */
  bounds: BoxI
  connectors: WorldConnector[]
}

/** Geometry for a definition placed at a position and rotation, without an instance. */
export function placeDefinition(def: PartDefinition, pos: V3I, rot: Rot, instanceId = 'ghost'): Omit<PlacedPart, 'instance'> {
  const size = def.size
  const boxes = def.boxes.map(b => offsetBox(rotBox(b, size, rot), pos))
  const rs = rotatedSize(size, rot)
  const bounds: BoxI = { min: pos, max: addI(pos, rs) }
  const connectors = def.connectors.map((c): WorldConnector => {
    const p = rotPoint2(c.pos2, size, rot)
    return {
      instanceId,
      connectorId: c.id,
      type: c.type,
      pos2: [p[0] + pos[0] * 2, p[1] + pos[1] * 2, p[2] + pos[2] * 2],
      dir: rotDir(c.dir, rot),
      tags: c.tags,
    }
  })
  return { def, boxes, bounds, connectors }
}

const cache = new WeakMap<PartInstance, PlacedPart>()
const cacheDefs = new WeakMap<PartInstance, PartDefinition>()

/** Cached placement of an immutable instance. Returns null for a missing definition. */
export function placeInstance(instance: PartInstance, catalog: PartCatalog): PlacedPart | null {
  const def = catalog.get(instance.defId)
  if (!def)
    return null
  const cached = cache.get(instance)
  if (cached && cacheDefs.get(instance) === def)
    return cached
  const placed: PlacedPart = { instance, ...placeDefinition(def, instance.pos, instance.rot, instance.id) }
  cache.set(instance, placed)
  cacheDefs.set(instance, def)
  return placed
}

export interface PlacedSet {
  placed: PlacedPart[]
  byId: Map<string, PlacedPart>
  missing: PartInstance[]
}

export function placeAll(instances: readonly PartInstance[], catalog: PartCatalog): PlacedSet {
  const placed: PlacedPart[] = []
  const missing: PartInstance[] = []
  const byId = new Map<string, PlacedPart>()
  for (const inst of instances) {
    const p = placeInstance(inst, catalog)
    if (p) {
      placed.push(p)
      byId.set(inst.id, p)
    }
    else {
      missing.push(inst)
    }
  }
  return { placed, byId, missing }
}

export function boundsOf(placed: readonly PlacedPart[]): BoxI | null {
  return unionBox(placed.map(p => p.bounds))
}

/** Coarse spatial hash over structural boxes for fast overlap queries. */
export class BoxIndex {
  private readonly cells = new Map<string, PlacedPart[]>()
  private static readonly CX = 4
  private static readonly CY = 6

  constructor(placed: readonly PlacedPart[]) {
    for (const p of placed) this.insert(p)
  }

  private static* cellKeys(b: BoxI): Generator<string> {
    const x0 = Math.floor(b.min[0] / BoxIndex.CX)
    const x1 = Math.floor((b.max[0] - 1) / BoxIndex.CX)
    const y0 = Math.floor(b.min[1] / BoxIndex.CY)
    const y1 = Math.floor((b.max[1] - 1) / BoxIndex.CY)
    const z0 = Math.floor(b.min[2] / BoxIndex.CX)
    const z1 = Math.floor((b.max[2] - 1) / BoxIndex.CX)
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) yield `${x},${y},${z}`
      }
    }
  }

  insert(p: PartInstancePlaced): void {
    for (const key of BoxIndex.cellKeys(p.bounds)) {
      const list = this.cells.get(key)
      if (list)
        list.push(p as PlacedPart)
      else
        this.cells.set(key, [p as PlacedPart])
    }
  }

  /** Parts whose bounds share a hash cell with the box. Callers do the exact test. */
  near(box: BoxI): Set<PlacedPart> {
    const out = new Set<PlacedPart>()
    for (const key of BoxIndex.cellKeys(box)) {
      const list = this.cells.get(key)
      if (list) {
        for (const p of list) out.add(p)
      }
    }
    return out
  }
}

type PartInstancePlaced = Pick<PlacedPart, 'bounds'>
