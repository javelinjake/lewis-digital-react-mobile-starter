import type { CarDocument, Forward } from '@/game/build/types'
/** Wheel contact preview, support polygon and centre of mass in the editor's lattice-metre frame. */
import type { PartCatalog } from '@/game/catalog/catalog'
import type { V3 } from '@/game/math'
import { computeAssemblies, mainAssemblyIds } from '@/game/build/assemblies'
import { placeAll } from '@/game/build/geometry'
import { FORWARD_VECTORS } from '@/game/build/types'
import { wheelCylinder } from '@/game/build/validate'
import { convexHull } from '@/game/vehicle/analysis'
import { compileVehicle } from '@/game/vehicle/compile'

export interface ContactPreview {
  /** Ground height under the wheels, metres. */
  groundY: number
  contacts: Array<{ id: string, x: number, z: number }>
  hull: Array<[number, number]>
  /** Centre of mass in lattice metres, or null when the car cannot be compiled. */
  com: V3 | null
}

/** Body-frame (lateral, up, forward) back to lattice metres. */
export function bodyToLattice(forward: Forward, body: V3): V3 {
  const f = FORWARD_VECTORS[forward]
  const l: V3 = [f[2], 0, -f[0]]
  return [body[0] * l[0] + body[2] * f[0], body[1], body[0] * l[2] + body[2] * f[2]]
}

export function contactPreview(doc: CarDocument, catalog: PartCatalog): ContactPreview {
  const assemblies = computeAssemblies(doc, catalog)
  const main = mainAssemblyIds(assemblies)
  const set = placeAll(doc.instances.filter(i => main.has(i.id)), catalog)
  const connected = new Set<string>()
  for (const c of doc.connections) {
    if (c.type === 'axle') {
      connected.add(c.a.instanceId)
      connected.add(c.b.instanceId)
    }
  }
  const cylinders = set.placed
    .filter(p => p.def.wheel && connected.has(p.instance.id))
    .map(p => wheelCylinder(p))
    .filter((c): c is NonNullable<typeof c> => c !== null)
  const contacts = cylinders.map(c => ({ id: c.instanceId, x: c.centre[0], z: c.centre[2] }))
  const groundY = cylinders.length > 0 ? Math.min(...cylinders.map(c => c.centre[1] - c.radius)) : 0
  const compiled = compileVehicle(doc, catalog)
  const com = compiled.ok ? bodyToLattice(doc.forward, compiled.spec.centreOfMassLattice) : null
  return { groundY, contacts, hull: convexHull(contacts.map(c => [c.x, c.z] as [number, number])), com }
}
