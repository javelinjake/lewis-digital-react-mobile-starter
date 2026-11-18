import type { BuildIssue, CarDocument } from '../build/types'
/** Derived properties for the inspection panel and the drive checks (block only for concrete simulation problems). */
import type { PartCatalog } from '../catalog/catalog'
import type { VehicleSpec } from './compile'
import { computeAssemblies } from '../build/assemblies'
import { catalog as shippedCatalog } from '../catalog/catalog'
import { compileVehicle } from './compile'
import { physicsConfig } from './physics-config'

export interface DerivedProperties {
  partCount: number
  mainPartCount: number
  loosePartCount: number
  /** Mass of the driving assembly, kg. */
  massKg: number
  /** Mass of everything including loose pieces, kg. */
  totalMassKg: number
  /** Width, height, length in metres. */
  sizeM: readonly [number, number, number]
  wheelCount: number
  /** Wheel contact points on the ground plane, body frame metres (x lateral, z forward). */
  contacts: Array<{ id: string, x: number, z: number }>
  supportHull: Array<[number, number]>
  comInsideSupport: boolean
  /** Sideways tip-over angle in degrees. Higher is steadier. */
  tipAngleDeg: number
  clearanceM: number
  centreOfMassHeightM: number
  airflow: { front: number, side: number, top: number, wings: number }
}

type P2 = [number, number]

export function convexHull(points: readonly P2[]): P2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length < 3)
    return pts
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: P2[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: P2[] = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** Smallest signed distance from the origin to the hull edges. Positive means inside. */
export function originMargin(hull: readonly P2[]): number {
  if (hull.length < 3)
    return -1
  let best = Infinity
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!
    const b = hull[(i + 1) % hull.length]!
    const ex = b[0] - a[0]
    const ez = b[1] - a[1]
    const len = Math.hypot(ex, ez) || 1
    // Hull is counter-clockwise, so the inside is to the left of each edge.
    const d = (ex * (0 - a[1]) - ez * (0 - a[0])) / len
    best = Math.min(best, d)
  }
  return best
}

export function deriveProperties(doc: CarDocument, spec: VehicleSpec | null, catalog: PartCatalog = shippedCatalog): DerivedProperties {
  const totalMassKg = doc.instances.reduce((a, i) => a + (catalog.get(i.defId)?.massKg ?? 0), 0)
  const assemblies = computeAssemblies(doc, catalog)
  const mainCount = assemblies.mainIndex >= 0 ? assemblies.components[assemblies.mainIndex]!.length : 0

  const groundY = spec?.wheelBottomY ?? 0
  const contacts = (spec?.wheels ?? []).map(w => ({ id: w.instanceId, x: w.pos[0], z: w.pos[2] }))
  const hull = convexHull(contacts.map(c => [c.x, c.z] as P2))
  const margin = originMargin(hull)
  const comHeight = Math.max(0.001, -groundY)
  return {
    partCount: doc.instances.length,
    mainPartCount: mainCount,
    loosePartCount: doc.instances.length - mainCount,
    massKg: spec?.mass ?? 0,
    totalMassKg,
    sizeM: spec?.size ?? [0, 0, 0],
    wheelCount: spec?.wheels.length ?? 0,
    contacts,
    supportHull: hull,
    comInsideSupport: margin > 0,
    tipAngleDeg: margin > 0 ? (Math.atan2(margin, comHeight) * 180) / Math.PI : 0,
    clearanceM: spec ? spec.bodyMinY - spec.wheelBottomY : 0,
    centreOfMassHeightM: comHeight,
    airflow: {
      front: spec?.aero.front ?? 0,
      side: spec?.aero.side ?? 0,
      top: spec?.aero.top ?? 0,
      wings: spec?.aero.wings.reduce((a, w) => a + w.area * (1 - w.shielded), 0) ?? 0,
    },
  }
}

export interface DriveAssessment {
  /** Concrete simulation problems. Launch is blocked. */
  blocks: BuildIssue[]
  /** Observations. Launch is allowed. */
  warnings: BuildIssue[]
  spec: VehicleSpec | null
  derived: DerivedProperties
}

const warn = (code: BuildIssue['code'], message: string, instanceIds: string[] = []): BuildIssue => ({ code, severity: 'warn', message, instanceIds })

export function assessDrive(doc: CarDocument, catalog: PartCatalog = shippedCatalog): DriveAssessment {
  const compiled = compileVehicle(doc, catalog)
  if (!compiled.ok)
    return { blocks: compiled.issues, warnings: [], spec: null, derived: deriveProperties(doc, null, catalog) }

  const { spec } = compiled
  const derived = deriveProperties(doc, spec, catalog)
  const warnings: BuildIssue[] = [...compiled.warnings]

  if (spec.looseInstanceIds.length > 0)
    warnings.push(warn('loose_pieces', `${spec.looseInstanceIds.length} loose piece${spec.looseInstanceIds.length === 1 ? ' is' : 's are'} not joined to the car.`, spec.looseInstanceIds))
  if (!spec.wheels.some(w => w.steering))
    warnings.push(warn('no_steering', 'No wheels steer, so this car will only go straight.', spec.wheels.map(w => w.instanceId)))
  if (!spec.wheels.some(w => w.driven))
    warnings.push(warn('odd_wheels', 'No wheel is driven. It can still roll downhill.', spec.wheels.map(w => w.instanceId)))
  if (!spec.wheels.some(w => w.axle[0] === 1))
    warnings.push(warn('odd_wheels', 'These wheels point sideways, so the car will slide instead of rolling forward. Check which way the front is.', spec.wheels.map(w => w.instanceId)))
  if (spec.wheels.length < 3 || !derived.comInsideSupport)
    warnings.push(warn('poor_balance', 'The wheels do not sit under the car\'s weight, so it may tip over.', spec.wheels.map(w => w.instanceId)))
  else if (derived.tipAngleDeg < 28)
    warnings.push(warn('high_centre', 'This car is tall and narrow. It may tip over in corners.', spec.wheels.map(w => w.instanceId)))
  if (derived.clearanceM < 0.012)
    warnings.push(warn('low_clearance', 'The body is very close to the ground and may scrape.'))

  const lowest = Math.min(...spec.wheels.map(w => w.pos[1] - w.radius))
  const floating = spec.wheels.filter(w => w.pos[1] - w.radius - lowest > 0.015)
  if (floating.length > 0)
    warnings.push(warn('floating_wheel', 'Some wheels sit higher than the others and may not touch the ground.', floating.map(w => w.instanceId)))

  const driven = spec.wheels.filter(w => w.driven)
  if (driven.length > 0) {
    const radius = driven.reduce((a, w) => a + w.radius, 0) / driven.length
    const accel = physicsConfig.motor.stallTorque / radius / spec.mass
    if (accel < 0.6)
      warnings.push(warn('unlikely_finish', 'This car is very heavy for the motor. It may struggle to finish.'))
  }
  return { blocks: [], warnings, spec, derived }
}
