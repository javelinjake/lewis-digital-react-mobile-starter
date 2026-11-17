import type { PlacedPart } from '../build/geometry'
import type { BuildIssue, CarDocument } from '../build/types'
/**
 * Vehicle compilation: connected assembly -> rigid body description for the simulation.
 * Body frame: origin at the centre of mass, +Z forward, +Y up, +X lateral (cross(up, forward)).
 */
import type { PartCatalog } from '../catalog/catalog'
import type { TyreId } from '../catalog/types'
import type { BoxI } from '../lattice'
import type { M3, Q4, V3 } from '../math'
import { computeAssemblies, mainAssemblyIds } from '../build/assemblies'
import { placeAll } from '../build/geometry'
import { FORWARD_VECTORS } from '../build/types'
import { wheelWarnings } from '../build/validate'
import { catalog as shippedCatalog } from '../catalog/catalog'
import { rotDir, rotPointReal } from '../lattice'
import { cross, dot, eigenSymmetric, isFiniteV3, UP } from '../math'
import { UNITS } from '../units'
import { mergeVoxelBoxes, projectedArea } from './voxels'

export interface WheelSpec {
  instanceId: string
  groupId: string | null
  /** Wheel centre in the body frame, metres. */
  pos: V3
  /** Unit axle vector (+X lateral or +Z forward), body frame. */
  axle: V3
  radius: number
  width: number
  tyre: TyreId
  massKg: number
  driven: boolean
  steering: boolean
  braking: boolean
  steerDirection: 1 | -1
  rubbing: boolean
}

export interface ColliderBox {
  centre: V3
  half: V3
}

export interface WingSpec {
  instanceId: string
  pos: V3
  area: number
  /** 0 = clean air, 1 = fully blanketed by bodywork ahead of it. */
  shielded: number
  /** Orientation factor: wings turned away from the airflow lose benefit. */
  alignment: number
}

export interface VehicleSpec {
  carId: string
  revisionId: string
  mass: number
  inertia: { values: V3, rotation: Q4 }
  colliders: ColliderBox[]
  wheels: WheelSpec[]
  aero: { front: number, side: number, top: number, wings: WingSpec[] }
  bounds: { min: V3, max: V3 }
  /** Lowest structural point of the body (not wheels), body frame. */
  bodyMinY: number
  /** Lowest wheel bottom, body frame. */
  wheelBottomY: number
  size: V3
  partCount: number
  looseInstanceIds: string[]
  /** Converts a lattice-metre point to the body frame (used by renderers). */
  centreOfMassLattice: V3
}

export type CompileResult
  = | { ok: true, spec: VehicleSpec, warnings: BuildIssue[] }
    | { ok: false, issues: BuildIssue[] }

const metres = (p: readonly number[]): V3 => [p[0]! * UNITS.studM, p[1]! * UNITS.plateM, p[2]! * UNITS.studM]

export function bodyMapper(forward: CarDocument['forward']) {
  const f = FORWARD_VECTORS[forward]
  const l = cross(UP, f as unknown as V3)
  return {
    point: (p: V3): V3 => [dot(p, l), p[1], dot(p, f as unknown as V3)],
    dir: (d: readonly number[]): V3 => [d[0]! * l[0] + d[2]! * l[2], d[1]!, d[0]! * f[0] + d[2]! * f[2]],
    /** Integer lattice voxel -> [lateral, y, forward] index. */
    voxel: (x: number, y: number, z: number): [number, number, number] => [x * l[0] + z * l[2], y, x * f[0] + z * f[2]],
  }
}

function boxInBody(b: BoxI, map: ReturnType<typeof bodyMapper>): { min: V3, max: V3 } {
  const lo = map.point(metres(b.min))
  const hi = map.point(metres(b.max))
  return {
    min: [Math.min(lo[0], hi[0]), Math.min(lo[1], hi[1]), Math.min(lo[2], hi[2])],
    max: [Math.max(lo[0], hi[0]), Math.max(lo[1], hi[1]), Math.max(lo[2], hi[2])],
  }
}

interface MassBox {
  mass: number
  centre: V3
  dims: V3
}

function massBoxesFor(p: PlacedPart, map: ReturnType<typeof bodyMapper>): MassBox[] {
  if (p.def.wheel) {
    const b = boxInBody(p.bounds, map)
    const dims: V3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
    return [{ mass: p.def.massKg, centre: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2], dims }]
  }
  const volumes = p.boxes.map(b => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]))
  const total = volumes.reduce((a, b) => a + b, 0) || 1
  return p.boxes.map((b, i) => {
    const m = boxInBody(b, map)
    return {
      mass: p.def.massKg * volumes[i]! / total,
      centre: [(m.min[0] + m.max[0]) / 2, (m.min[1] + m.max[1]) / 2, (m.min[2] + m.max[2]) / 2] as V3,
      dims: [m.max[0] - m.min[0], m.max[1] - m.min[1], m.max[2] - m.min[2]] as V3,
    }
  })
}

function issue(code: BuildIssue['code'], message: string, instanceIds: string[] = [], severity: BuildIssue['severity'] = 'block'): BuildIssue {
  return { code, severity, message, instanceIds }
}

export function compileVehicle(doc: CarDocument, catalog: PartCatalog = shippedCatalog): CompileResult {
  const assemblies = computeAssemblies(doc, catalog)
  if (doc.instances.length === 0 || assemblies.mainIndex < 0)
    return { ok: false, issues: [issue('nothing_to_drive', 'Add some pieces before you drive.')] }

  const mainIds = mainAssemblyIds(assemblies)
  const mainInstances = doc.instances.filter(i => mainIds.has(i.id))
  const set = placeAll(mainInstances, catalog)

  if (set.missing.length > 0) {
    return {
      ok: false,
      issues: set.missing.map(m => issue('unknown_part', 'This piece is missing from the catalogue, so the car cannot be built.', [m.id])),
    }
  }

  const map = bodyMapper(doc.forward)
  const connectedAxle = new Set<string>()
  for (const c of doc.connections) {
    if (c.type === 'axle') {
      connectedAxle.add(c.a.instanceId)
      connectedAxle.add(c.b.instanceId)
    }
  }

  const wheelParts = set.placed.filter(p => p.def.wheel && connectedAxle.has(p.instance.id) && p.connectors.some(c => c.type === 'hub'))
  if (wheelParts.length === 0) {
    return { ok: false, issues: [issue('no_wheels', 'This car has no wheel sitting on a wheel mount or axle.', set.placed.filter(p => p.def.wheel).map(p => p.instance.id))] }
  }

  // Mass properties.
  const massBoxes = set.placed.flatMap(p => massBoxesFor(p, map))
  const mass = massBoxes.reduce((a, b) => a + b.mass, 0)
  if (!Number.isFinite(mass) || mass <= 0)
    return { ok: false, issues: [issue('non_finite_mass', 'The car has no usable weight.')] }

  const com: V3 = [
    massBoxes.reduce((a, b) => a + b.mass * b.centre[0], 0) / mass,
    massBoxes.reduce((a, b) => a + b.mass * b.centre[1], 0) / mass,
    massBoxes.reduce((a, b) => a + b.mass * b.centre[2], 0) / mass,
  ]
  if (!isFiniteV3(com))
    return { ok: false, issues: [issue('non_finite_mass', 'The car has no usable weight.')] }

  let ixx = 0
  let iyy = 0
  let izz = 0
  let ixy = 0
  let ixz = 0
  let iyz = 0
  for (const b of massBoxes) {
    const [dx, dy, dz] = b.dims
    const x = b.centre[0] - com[0]
    const y = b.centre[1] - com[1]
    const z = b.centre[2] - com[2]
    ixx += b.mass * ((dy * dy + dz * dz) / 12 + y * y + z * z)
    iyy += b.mass * ((dx * dx + dz * dz) / 12 + x * x + z * z)
    izz += b.mass * ((dx * dx + dy * dy) / 12 + x * x + y * y)
    ixy -= b.mass * x * y
    ixz -= b.mass * x * z
    iyz -= b.mass * y * z
  }
  const tensor: M3 = [ixx, ixy, ixz, ixy, iyy, iyz, ixz, iyz, izz]
  const inertia = eigenSymmetric(tensor)

  // Collider boxes: merge structural voxels, ignoring the tyre sweep (wheels are ray-cast).
  const solids = set.placed.filter(p => !p.def.wheel)
  const merged = mergeVoxelBoxes(solids.flatMap(p => p.boxes))
  const colliders: ColliderBox[] = merged.map((b) => {
    const m = boxInBody(b, map)
    return {
      centre: [(m.min[0] + m.max[0]) / 2 - com[0], (m.min[1] + m.max[1]) / 2 - com[1], (m.min[2] + m.max[2]) / 2 - com[2]],
      half: [(m.max[0] - m.min[0]) / 2, (m.max[1] - m.min[1]) / 2, (m.max[2] - m.min[2]) / 2],
    }
  })

  // Wheels.
  const rubbing = new Set(wheelWarnings(set).filter(w => w.code === 'wheel_touches_body').map(w => w.instanceIds[0]!))
  const wheels: WheelSpec[] = wheelParts.map((p) => {
    const hub = p.connectors.find(c => c.type === 'hub')!
    const props = p.def.wheel!
    const hubM = metres([hub.pos2[0] / 2, hub.pos2[1] / 2, hub.pos2[2] / 2])
    const outward = rotDir([-hub.dir[0], 0, -hub.dir[2]], 0)
    const centreM: V3 = [hubM[0] + outward[0] * props.widthM / 2, hubM[1], hubM[2] + outward[2] * props.widthM / 2]
    const body = map.point(centreM)
    const axleDir = map.dir(hub.dir)
    const axle: V3 = Math.abs(axleDir[0]) > 0.5 ? [1, 0, 0] : [0, 0, 1]
    const group = doc.wheelGroups.find(g => g.instanceIds.includes(p.instance.id))
    return {
      instanceId: p.instance.id,
      groupId: group?.id ?? null,
      pos: [body[0] - com[0], body[1] - com[1], body[2] - com[2]],
      axle,
      radius: props.radiusM,
      width: props.widthM,
      tyre: props.tyre,
      massKg: props.massKg,
      driven: group?.driven ?? true,
      steering: group?.steering ?? false,
      braking: group?.braking ?? true,
      steerDirection: group?.steerDirection ?? 1,
      rubbing: rubbing.has(p.instance.id),
    }
  })

  // Aero: coarse occupancy projection so hidden parts are not double counted.
  const everything = set.placed.map(p => p.def.wheel ? p.bounds : null).filter((b): b is BoxI => b !== null)
  const area = projectedArea([...solids.flatMap(p => p.boxes), ...everything], map.voxel)
  const wings: WingSpec[] = set.placed.filter(p => p.def.aero?.wing).map((p) => {
    const w = p.def.aero!.wing!
    const local = rotPointReal(w.centre, p.def.size, p.instance.rot)
    const lattice: V3 = [local[0] + p.instance.pos[0], local[1] + p.instance.pos[1], local[2] + p.instance.pos[2]]
    const pos = map.point(metres(lattice))
    const longAxis = map.dir(rotDir([1, 0, 0], p.instance.rot))
    return {
      instanceId: p.instance.id,
      pos: [pos[0] - com[0], pos[1] - com[1], pos[2] - com[2]],
      area: w.areaM2,
      shielded: wingShielding(p, set.placed, map),
      alignment: 0.35 + 0.65 * Math.abs(longAxis[0]),
    }
  })

  // Bounds.
  const allBoxes = [...solids.flatMap(p => p.boxes), ...everything].map(b => boxInBody(b, map))
  const min: V3 = [Math.min(...allBoxes.map(b => b.min[0])) - com[0], Math.min(...allBoxes.map(b => b.min[1])) - com[1], Math.min(...allBoxes.map(b => b.min[2])) - com[2]]
  const max: V3 = [Math.max(...allBoxes.map(b => b.max[0])) - com[0], Math.max(...allBoxes.map(b => b.max[1])) - com[1], Math.max(...allBoxes.map(b => b.max[2])) - com[2]]
  const bodyMinY = colliders.length ? Math.min(...colliders.map(c => c.centre[1] - c.half[1])) : 0
  const wheelBottomY = Math.min(...wheels.map(w => w.pos[1] - w.radius))

  const spec: VehicleSpec = {
    carId: doc.carId,
    revisionId: doc.revisionId,
    mass,
    inertia,
    colliders,
    wheels,
    aero: { ...area, wings },
    bounds: { min, max },
    bodyMinY,
    wheelBottomY,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    partCount: set.placed.length,
    looseInstanceIds: doc.instances.filter(i => !mainIds.has(i.id)).map(i => i.id),
    centreOfMassLattice: com,
  }
  return { ok: true, spec, warnings: wheelWarnings(set) }
}

/** Fraction of a wing's lateral span with bodywork directly ahead of it at wing height. */
function wingShielding(wing: PlacedPart, all: readonly PlacedPart[], map: ReturnType<typeof bodyMapper>): number {
  const slab = wing.boxes[wing.boxes.length - 1]!
  const columns: number[] = []
  const [lat0, , f0] = map.voxel(slab.min[0], 0, slab.min[2])
  const [lat1, , f1] = map.voxel(slab.max[0] - 1, 0, slab.max[2] - 1)
  const latMin = Math.min(lat0, lat1)
  const latMax = Math.max(lat0, lat1)
  const fMax = Math.max(f0, f1)
  for (let l = latMin; l <= latMax; l++) columns.push(l)
  let shielded = 0
  for (const l of columns) {
    const blocked = all.some(p => p !== wing && !p.def.wheel && p.boxes.some((b) => {
      if (b.max[1] <= slab.min[1] || b.min[1] >= slab.max[1])
        return false
      const lo = map.voxel(b.min[0], 0, b.min[2])
      const hi = map.voxel(b.max[0] - 1, 0, b.max[2] - 1)
      const bl0 = Math.min(lo[0], hi[0])
      const bl1 = Math.max(lo[0], hi[0])
      const bf1 = Math.max(lo[2], hi[2])
      return l >= bl0 && l <= bl1 && bf1 > fMax
    }))
    if (blocked)
      shielded += 1
  }
  return columns.length === 0 ? 0 : shielded / columns.length
}
