import type { LocalGeo, V3 } from './geo'
import type { Slot } from './materials'
import type { PartInstance } from '@/game/build/types'
/**
 * Part geometry in lattice-metre space. Local shapes (part-shapes.ts) are cached per definition and
 * then rotated with the same yaw quarter-turn convention as the model (`rotPointReal`), so what you see
 * matches the validated placement exactly. Never use three.js rotation for parts.
 */
import type { PartDefinition } from '@/game/catalog/types'
import type { Rot, V3I } from '@/game/lattice'
import * as THREE from 'three'
import { UNITS } from '@/game/units'
import { localToGeometry, MeshData } from './geo'
import { buildLocalSlots, buildStudGeos } from './part-shapes'

const S = UNITS.studM
const P = UNITS.plateM

/** Maps lattice-metre points and directions into another frame (e.g. a car's body frame). */
export interface FrameMap {
  point: (p: V3) => V3
  dir: (n: V3) => V3
}

export interface PlacementTransform {
  /** Definition size in lattice units. */
  size: V3I
  rot: Rot
  /** Minimum corner of the rotated bounds, lattice units. */
  pos: V3I
  frame?: FrameMap
}

export interface LocalPart {
  slots: Map<Slot, LocalGeo>
  /** One entry per stud connector, in the primary material. */
  studs: Array<{ id: string, geo: LocalGeo }>
}

const localCache = new Map<string, LocalPart>()
const wheelCache = new Map<string, Map<Slot, THREE.BufferGeometry>>()

const cacheKey = (def: PartDefinition) => `${def.id}@${def.version}`

/** Cached local-space geometry per definition. */
export function getLocalGeo(def: PartDefinition): LocalPart {
  const key = cacheKey(def)
  let cached = localCache.get(key)
  if (!cached) {
    const slots = new Map<Slot, LocalGeo>()
    for (const [slot, md] of buildLocalSlots(def)) {
      if (!md.isEmpty())
        slots.set(slot, md.toLocal())
    }
    cached = { slots, studs: buildStudGeos(def).map(s => ({ id: s.id, geo: s.md.toLocal() })) }
    localCache.set(key, cached)
  }
  return cached
}

/** Accumulates transformed copies of local geometry into one merged buffer. */
export class GeometryAccumulator {
  positions: number[] = []
  normals: number[] = []
  indices: number[] = []

  get triangleCount(): number {
    return this.indices.length / 3
  }

  add(local: LocalGeo, t: PlacementTransform): void {
    const W = t.size[0] * S
    const D = t.size[2] * S
    const px = t.pos[0] * S
    const py = t.pos[1] * P
    const pz = t.pos[2] * S
    const base = this.positions.length / 3
    const src = local.positions
    const nrm = local.normals
    for (let i = 0; i < src.length; i += 3) {
      const x = src[i]!
      const y = src[i + 1]!
      const z = src[i + 2]!
      const nx = nrm[i]!
      const ny = nrm[i + 1]!
      const nz = nrm[i + 2]!
      let X: number
      let Z: number
      let NX: number
      let NZ: number
      switch (t.rot) {
        case 1:
          X = D - z
          Z = x
          NX = -nz
          NZ = nx
          break
        case 2:
          X = W - x
          Z = D - z
          NX = -nx
          NZ = -nz
          break
        case 3:
          X = z
          Z = W - x
          NX = nz
          NZ = -nx
          break
        default:
          X = x
          Z = z
          NX = nx
          NZ = nz
      }
      let p: V3 = [X + px, y + py, Z + pz]
      let n: V3 = [NX, ny, NZ]
      if (t.frame) {
        p = t.frame.point(p)
        n = t.frame.dir(n)
      }
      this.positions.push(p[0], p[1], p[2])
      this.normals.push(n[0], n[1], n[2])
    }
    for (let i = 0; i < local.indices.length; i++) this.indices.push(base + local.indices[i]!)
  }

  isEmpty(): boolean {
    return this.indices.length === 0
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.positions), 3))
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.normals), 3))
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.indices), 1))
    g.computeBoundingBox()
    g.computeBoundingSphere()
    return g
  }
}

/**
 * Geometry for one placed part, by material slot, already rotated and translated into lattice-metre space.
 * `hideStuds` lists stud connector ids to omit (studs covered by a connected part are invisible).
 */
export function buildPartGeometry(
  def: PartDefinition,
  instance: Pick<PartInstance, 'pos' | 'rot'>,
  hideStuds?: ReadonlySet<string>,
): { bySlot: Map<Slot, THREE.BufferGeometry> } {
  const bySlot = new Map<Slot, THREE.BufferGeometry>()
  const local = getLocalGeo(def)
  const t: PlacementTransform = { size: def.size, rot: instance.rot, pos: instance.pos }
  for (const [slot, geo] of local.slots) {
    const acc = new GeometryAccumulator()
    acc.add(geo, t)
    if (slot === 'primary') {
      for (const stud of local.studs) {
        if (!hideStuds?.has(stud.id))
          acc.add(stud.geo, t)
      }
    }
    bySlot.set(slot, acc.toGeometry())
  }
  return { bySlot }
}

/**
 * Wheel geometry centred on the wheel with the axle along +X and the outer (hub cap) face toward +X.
 * Shared between wheel nodes of the same definition; do not dispose individually.
 */
export function getWheelNodeGeometry(def: PartDefinition): Map<Slot, THREE.BufferGeometry> {
  const key = cacheKey(def)
  let cached = wheelCache.get(key)
  if (!cached) {
    cached = new Map()
    const w = def.wheel!.widthM
    const cy = (def.size[1] * P) / 2
    const cz = (def.size[2] * S) / 2
    for (const [slot, local] of getLocalGeo(def).slots) {
      const g = localToGeometry(local)
      g.translate(-w / 2, -cy, -cz)
      cached.set(slot, g)
    }
    wheelCache.set(key, cached)
  }
  return cached
}

/** Placeholder box for a part whose definition cannot be found. */
export function placeholderGeometry(pos: V3I, size: V3I = [2, 3, 2]): THREE.BufferGeometry {
  const md = new MeshData()
  const acc = new GeometryAccumulator()
  const g = new THREE.BoxGeometry(size[0] * S, size[1] * P, size[2] * S)
  g.translate((size[0] * S) / 2, (size[1] * P) / 2, (size[2] * S) / 2)
  md.addGeometry(g)
  g.dispose()
  acc.add(md.toLocal(), { size, rot: 0, pos })
  return acc.toGeometry()
}

export function clearGeometryCache(): void {
  localCache.clear()
  for (const m of wheelCache.values()) {
    for (const g of m.values()) g.dispose()
  }
  wheelCache.clear()
}
