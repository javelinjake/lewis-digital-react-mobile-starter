import type { BoxI, V3I } from '../lattice'
import type { PlacedPart, PlacedSet } from './geometry'
import type { BuildIssue, Connection } from './types'
import { boxesOverlap } from '../lattice'
import { UNITS } from '../units'
import { BoxIndex } from './geometry'

type Candidate = Pick<PlacedPart, 'boxes' | 'bounds'>

/** Exact structural overlap between a candidate and anything in the index. */
export function overlappingParts(candidate: Candidate, index: BoxIndex, ignoreIds?: ReadonlySet<string>): PlacedPart[] {
  const out: PlacedPart[] = []
  for (const other of index.near(candidate.bounds)) {
    if (ignoreIds?.has(other.instance.id))
      continue
    if (!boxesOverlap(candidate.bounds, other.bounds))
      continue
    if (candidate.boxes.some(a => other.boxes.some(b => boxesOverlap(a, b))))
      out.push(other)
  }
  return out
}

export interface WheelCylinder {
  instanceId: string
  /** Centre in metres. */
  centre: readonly [number, number, number]
  radius: number
  halfWidth: number
  /** Horizontal axle axis. */
  axis: 'x' | 'z'
}

/** Swept volume of a mounted wheel, derived from its hub connector. */
export function wheelCylinder(p: PlacedPart): WheelCylinder | null {
  const wheel = p.def.wheel
  const hub = p.connectors.find(c => c.type === 'hub')
  if (!wheel || !hub)
    return null
  const axisX = hub.dir[0] !== 0
  const axisZ = hub.dir[2] !== 0
  if (!axisX && !axisZ)
    return null
  const half = wheel.widthM / 2
  const outward = axisX ? -hub.dir[0] : -hub.dir[2]
  const hubM = [hub.pos2[0] / 2 * UNITS.studM, hub.pos2[1] / 2 * UNITS.plateM, hub.pos2[2] / 2 * UNITS.studM] as const
  const centre: [number, number, number] = [hubM[0], hubM[1], hubM[2]]
  if (axisX)
    centre[0] += outward * half
  else
    centre[2] += outward * half
  return { instanceId: p.instance.id, centre, radius: wheel.radiusM, halfWidth: half, axis: axisX ? 'x' : 'z' }
}

const EPS = 1e-4

function boxM(b: BoxI) {
  return {
    min: [b.min[0] * UNITS.studM, b.min[1] * UNITS.plateM, b.min[2] * UNITS.studM] as const,
    max: [b.max[0] * UNITS.studM, b.max[1] * UNITS.plateM, b.max[2] * UNITS.studM] as const,
  }
}

export function cylinderHitsBox(c: WheelCylinder, box: BoxI): boolean {
  const m = boxM(box)
  const ai = c.axis === 'x' ? 0 : 2
  const oi = c.axis === 'x' ? 2 : 0
  if (!(c.centre[ai] - c.halfWidth < m.max[ai] - EPS && c.centre[ai] + c.halfWidth > m.min[ai] + EPS))
    return false
  const nearestY = Math.max(m.min[1], Math.min(c.centre[1], m.max[1]))
  const nearestO = Math.max(m.min[oi], Math.min(c.centre[oi], m.max[oi]))
  return Math.hypot(nearestY - c.centre[1], nearestO - c.centre[oi]) < c.radius - EPS
}

export function cylindersTouch(a: WheelCylinder, b: WheelCylinder): boolean {
  if (a.axis !== b.axis)
    return false
  const ai = a.axis === 'x' ? 0 : 2
  const oi = a.axis === 'x' ? 2 : 0
  const axial = Math.abs(a.centre[ai] - b.centre[ai]) < a.halfWidth + b.halfWidth - EPS
  const radial = Math.hypot(a.centre[1] - b.centre[1], a.centre[oi] - b.centre[oi]) < a.radius + b.radius - EPS
  return axial && radial
}

/** Which wheels have an axle connection. */
export function mountedWheelIds(set: PlacedSet, connections: readonly Connection[]): Set<string> {
  const mounted = new Set<string>()
  for (const c of connections) {
    if (c.type !== 'axle')
      continue
    for (const id of [c.a.instanceId, c.b.instanceId]) {
      if (set.byId.get(id)?.def.wheel)
        mounted.add(id)
    }
  }
  return mounted
}

/** Non-blocking wheel warnings: touching bodywork and touching other wheels. */
export function wheelWarnings(set: PlacedSet, only?: ReadonlySet<string>): BuildIssue[] {
  const wheels = set.placed.filter(p => p.def.wheel)
  const cylinders = wheels.map(wheelCylinder).filter((c): c is WheelCylinder => c !== null)
  const issues: BuildIssue[] = []
  const index = new BoxIndex(set.placed.filter(p => !p.def.wheel))

  for (const c of cylinders) {
    if (only && !only.has(c.instanceId))
      continue
    const reach: BoxI = {
      min: [Math.floor((c.centre[0] - (c.axis === 'x' ? c.halfWidth : c.radius)) / UNITS.studM), Math.floor((c.centre[1] - c.radius) / UNITS.plateM), Math.floor((c.centre[2] - (c.axis === 'z' ? c.halfWidth : c.radius)) / UNITS.studM)] as V3I,
      max: [Math.ceil((c.centre[0] + (c.axis === 'x' ? c.halfWidth : c.radius)) / UNITS.studM), Math.ceil((c.centre[1] + c.radius) / UNITS.plateM), Math.ceil((c.centre[2] + (c.axis === 'z' ? c.halfWidth : c.radius)) / UNITS.studM)] as V3I,
    }
    const hits = [...index.near(reach)].filter(p => p.boxes.some(b => cylinderHitsBox(c, b)))
    if (hits.length > 0) {
      issues.push({
        code: 'wheel_touches_body',
        severity: 'warn',
        instanceIds: [c.instanceId, ...hits.map(h => h.instance.id).slice(0, 3)],
        message: 'This wheel touches the body.',
      })
    }
    for (const other of cylinders) {
      if (other.instanceId <= c.instanceId)
        continue
      if (cylindersTouch(c, other)) {
        issues.push({
          code: 'wheel_touches_wheel',
          severity: 'warn',
          instanceIds: [c.instanceId, other.instanceId],
          message: 'These two wheels touch each other.',
        })
      }
    }
  }
  return issues
}
