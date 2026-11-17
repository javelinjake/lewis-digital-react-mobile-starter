import type { V3 } from './geo'
import type { Slot } from './materials'
import type { Aabb } from './overlays'
import type { CarDocument } from '@/game/build/types'
/**
 * Car models. `buildBuilderModel` renders the whole document in the lattice-metre frame for the editor;
 * `buildDrivingCarModel` (driving-model.ts) renders the compiled car in its physics body frame.
 * Static geometry is merged per material so a car is a handful of draw calls.
 */
import type { PartCatalog } from '@/game/catalog/catalog'
import * as THREE from 'three'
import { placeInstance } from '@/game/build/geometry'
import { colourHex } from '@/game/catalog/palette'
import { UNITS } from '@/game/units'
import { countTriangles, disposeObject } from './dispose'
import { desaturate, materialForSlot, placeholderMaterial } from './materials'
import { createBoxOverlay, ISSUE_STYLE, LOOSE_STYLE, SELECTION_STYLE } from './overlays'
import { GeometryAccumulator, getLocalGeo, placeholderGeometry } from './part-geometry'

export { createFloorMat, createGhost, createMirrorPlane, createSnapMarkers, type SnapMarkers } from './builder-extras'

export interface BuilderModelOptions {
  /** Detached pieces are drawn desaturated. Pass the same ids you give `setLoose`. */
  loose?: ReadonlySet<string>
}

export interface BuilderModel {
  /** Lattice-metre frame, +Y up, origin at the lattice origin. */
  root: THREE.Group
  /** World AABB per instance, metres. */
  bounds: Map<string, Aabb>
  stats: { triangles: number, meshes: number, materials: number }
  setSelection: (ids: ReadonlySet<string>) => void
  setLoose: (ids: ReadonlySet<string>) => void
  setIssues: (ids: ReadonlySet<string>) => void
  /** Nearest instance whose bounds the ray hits. */
  pick: (ray: THREE.Ray) => string | null
  /** Animate highlights; call once per frame with elapsed seconds. */
  tick: (seconds: number) => void
  dispose: () => void
}

const S = UNITS.studM
const P = UNITS.plateM

export function buildBuilderModel(doc: CarDocument, catalog: PartCatalog, opts: BuilderModelOptions = {}): BuilderModel {
  const root = new THREE.Group()
  root.name = 'builder-model'
  const bounds = new Map<string, Aabb>()
  const boxes = new Map<string, THREE.Box3>()

  const connected = new Map<string, Set<string>>()
  for (const c of doc.connections) {
    for (const end of [c.a, c.b]) {
      const set = connected.get(end.instanceId) ?? new Set<string>()
      set.add(end.connectorId)
      connected.set(end.instanceId, set)
    }
  }

  const buckets = new Map<string, { slot: Slot, hex: string, acc: GeometryAccumulator }>()
  const bucket = (slot: Slot, hex: string) => {
    const key = slot === 'primary' ? `${slot}:${hex}` : slot
    let b = buckets.get(key)
    if (!b) {
      b = { slot, hex, acc: new GeometryAccumulator() }
      buckets.set(key, b)
    }
    return b.acc
  }

  const placeholders: THREE.BufferGeometry[] = []
  for (const inst of doc.instances) {
    const def = catalog.get(inst.defId)
    let aabb: Aabb
    if (!def) {
      const g = placeholderGeometry(inst.pos)
      placeholders.push(g)
      aabb = { min: [inst.pos[0] * S, inst.pos[1] * P, inst.pos[2] * S], max: [(inst.pos[0] + 2) * S, (inst.pos[1] + 3) * P, (inst.pos[2] + 2) * S] }
    }
    else {
      const placed = placeInstance(inst, catalog)!
      const b = placed.bounds
      aabb = { min: [b.min[0] * S, b.min[1] * P, b.min[2] * S], max: [b.max[0] * S, b.max[1] * P, b.max[2] * S] }
      const hex = opts.loose?.has(inst.id) ? desaturate(colourHex(inst.colour), 0.55) : colourHex(inst.colour)
      const local = getLocalGeo(def)
      const t = { size: def.size, rot: inst.rot, pos: inst.pos }
      for (const [slot, geo] of local.slots) bucket(slot, hex).add(geo, t)
      const hidden = connected.get(inst.id)
      const primary = bucket('primary', hex)
      for (const stud of local.studs) {
        if (!hidden?.has(stud.id))
          primary.add(stud.geo, t)
      }
    }
    bounds.set(inst.id, aabb)
    boxes.set(inst.id, new THREE.Box3(new THREE.Vector3(...aabb.min), new THREE.Vector3(...aabb.max)))
  }

  const materials = new Set<THREE.Material>()
  for (const { slot, hex, acc } of buckets.values()) {
    if (acc.isEmpty())
      continue
    const material = materialForSlot(slot, hex)
    materials.add(material)
    const mesh = new THREE.Mesh(acc.toGeometry(), material)
    mesh.castShadow = slot !== 'glass'
    mesh.receiveShadow = slot !== 'glass'
    if (slot === 'glass')
      mesh.renderOrder = 2
    root.add(mesh)
  }
  for (const g of placeholders) {
    const mesh = new THREE.Mesh(g, placeholderMaterial())
    mesh.renderOrder = 3
    materials.add(mesh.material as THREE.Material)
    root.add(mesh)
  }

  const selection = createBoxOverlay(SELECTION_STYLE)
  const loose = createBoxOverlay(LOOSE_STYLE)
  const issues = createBoxOverlay(ISSUE_STYLE)
  root.add(loose.root, selection.root, issues.root)

  const aabbs = (ids: ReadonlySet<string>) => [...ids].map(id => bounds.get(id)).filter((b): b is Aabb => b !== undefined)
  const hit = new THREE.Vector3()

  return {
    root,
    bounds,
    stats: { triangles: countTriangles(root), meshes: root.children.filter(c => (c as THREE.Mesh).isMesh).length, materials: materials.size },
    setSelection: ids => selection.set(aabbs(ids)),
    setLoose: ids => loose.set(aabbs(ids)),
    setIssues: ids => issues.set(aabbs(ids)),
    pick(ray) {
      let best: string | null = null
      let bestDistance = Infinity
      for (const [id, box] of boxes) {
        if (ray.intersectBox(box, hit)) {
          const d = ray.origin.distanceTo(hit)
          if (d < bestDistance) {
            bestDistance = d
            best = id
          }
        }
      }
      return best
    },
    tick(seconds) {
      issues.pulse(0.55 + 0.45 * Math.sin(seconds * 7))
      selection.pulse(0.85 + 0.15 * Math.sin(seconds * 4))
    },
    dispose() {
      selection.dispose()
      loose.dispose()
      issues.dispose()
      disposeObject(root)
      root.clear()
    },
  }
}

export type { V3 }
export { buildDrivingCarModel, type CarModel, type WheelPose } from './driving-model'
export type { Aabb } from './overlays'
