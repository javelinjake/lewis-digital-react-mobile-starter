import type { PlacedSet } from './geometry'
import type { CarDocument, Forward, WheelGroup } from './types'

const FORWARD_AXIS: Record<Forward, { axis: 0 | 2, sign: 1 | -1 }> = {
  'z+': { axis: 2, sign: 1 },
  'z-': { axis: 2, sign: -1 },
  'x+': { axis: 0, sign: 1 },
  'x-': { axis: 0, sign: -1 },
}

/** Position of a wheel hub along (f) and across (l) the car, in doubled lattice units. */
export function hubCoordinates(set: PlacedSet, instanceId: string, forward: Forward): { f: number, l: number, y: number } | null {
  const hub = set.byId.get(instanceId)?.connectors.find(c => c.type === 'hub')
  if (!hub)
    return null
  const { axis, sign } = FORWARD_AXIS[forward]
  const lateralAxis = axis === 2 ? 0 : 2
  return { f: hub.pos2[axis] * sign, l: hub.pos2[lateralAxis], y: hub.pos2[1] }
}

function pairsFor(ids: string[], set: PlacedSet, forward: Forward): Array<[string, string]> {
  const sorted = ids
    .map(id => ({ id, l: hubCoordinates(set, id, forward)?.l ?? 0 }))
    .sort((a, b) => a.l - b.l || (a.id < b.id ? -1 : 1))
  const pairs: Array<[string, string]> = []
  for (let i = 0; i < Math.floor(sorted.length / 2); i++)
    pairs.push([sorted[i]!.id, sorted[sorted.length - 1 - i]!.id])
  return pairs
}

/**
 * Keep explicit wheel groups consistent with the instances. Existing groups and
 * their roles are preserved. New wheels join the group on the same axle line or
 * start a new group with default roles (brakes on, driven, front-most steers).
 */
export function reconcileWheelGroups(
  doc: Pick<CarDocument, 'instances' | 'wheelGroups' | 'forward'>,
  set: PlacedSet,
  newId: () => string,
): WheelGroup[] {
  const wheelIds = new Set(set.placed.filter(p => p.def.wheel).map(p => p.instance.id))
  const groups: WheelGroup[] = doc.wheelGroups
    .map(g => ({ ...g, instanceIds: g.instanceIds.filter(id => wheelIds.has(id)) }))
    .filter(g => g.instanceIds.length > 0)

  const grouped = new Set(groups.flatMap(g => g.instanceIds))
  const fresh = [...wheelIds].filter(id => !grouped.has(id)).sort()

  const axleKey = (id: string) => {
    const c = hubCoordinates(set, id, doc.forward)
    return c ? `${c.f}|${c.y}` : id
  }
  const groupKeys = new Map<string, WheelGroup>()
  for (const g of groups) {
    const first = g.instanceIds[0]
    if (first)
      groupKeys.set(axleKey(first), g)
  }

  for (const id of fresh) {
    const key = axleKey(id)
    const existing = groupKeys.get(key)
    if (existing) {
      existing.instanceIds = [...existing.instanceIds, id]
      continue
    }
    const created: WheelGroup = {
      id: newId(),
      instanceIds: [id],
      driven: true,
      steering: false,
      braking: true,
      steerDirection: 1,
      userRoles: false,
      symmetry: [],
    }
    groups.push(created)
    groupKeys.set(key, created)
  }

  // Default steering: until the player sets roles, the front-most axle steers.
  const defaults = groups.filter(g => !g.userRoles)
  if (defaults.length > 0) {
    const frontF = (g: WheelGroup) => hubCoordinates(set, g.instanceIds[0]!, doc.forward)?.f ?? 0
    const anyUser = groups.some(g => g.userRoles && g.steering)
    const front = [...defaults].sort((a, b) => frontF(b) - frontF(a))[0]
    for (const g of defaults)
      g.steering = !anyUser && g === front
  }

  return groups.map(g => ({ ...g, symmetry: pairsFor(g.instanceIds, set, doc.forward) }))
}
