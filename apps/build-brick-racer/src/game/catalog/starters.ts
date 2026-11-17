import type { EditContext } from '../build/doc'
import type { NewPart } from '../build/edit'
import type { CarDocument } from '../build/types'
import type { Rot, V3I } from '../lattice'
/**
 * Starter cars are ordinary build data made from the same parts as user cars, authored through the
 * same validated edit pipeline. They carry no hidden physical advantages. Players can dismantle,
 * duplicate and modify them.
 */
import type { PartCatalog } from './catalog'
import { createEmptyDoc, defaultContext } from '../build/doc'
import { addParts, setWheelRoles } from '../build/edit'
import { placeAll, placeDefinition } from '../build/geometry'
import { hubCoordinates } from '../build/wheel-groups'

export interface StarterInfo {
  id: 'racer' | 'buggy'
  name: string
  tagline: string
}

export const STARTERS: readonly StarterInfo[] = [
  { id: 'racer', name: 'Racer', tagline: 'Low and quick' },
  { id: 'buggy', name: 'Buggy', tagline: 'Ready for mud' },
]

const part = (defId: string, pos: V3I, colour: string, rot: Rot = 0): NewPart => ({ defId, pos, colour, rot })

/** Position and rotation that seat a wheel's hub on one of a mount's axle connectors. */
function wheelAt(catalog: PartCatalog, mountDefId: string, mountPos: V3I, side: 'pos' | 'neg', wheelDefId: string, colour: string): NewPart {
  const mount = catalog.get(mountDefId)!
  const wheel = catalog.get(wheelDefId)!
  const axle = placeDefinition(mount, mountPos, 0).connectors.find(c => c.connectorId === (side === 'pos' ? 'ax_pos' : 'ax_neg'))!
  const rot: Rot = side === 'pos' ? 0 : 2
  const probe = placeDefinition(wheel, [0, 0, 0], rot).connectors.find(c => c.type === 'hub')!
  return part(wheelDefId, [(axle.pos2[0] - probe.pos2[0]) / 2, (axle.pos2[1] - probe.pos2[1]) / 2, (axle.pos2[2] - probe.pos2[2]) / 2], colour, rot)
}

function racerParts(catalog: PartCatalog): NewPart[] {
  const mounts: V3I[] = [[0, 0, 1], [4, 0, 1], [0, 0, 10], [4, 0, 10]]
  return [
    part('chassis_short', [0, 3, 0], 'grey'),
    ...mounts.map(m => part('wheel_mount', m, 'black')),
    ...mounts.map(m => wheelAt(catalog, 'wheel_mount', m, m[0] === 0 ? 'neg' : 'pos', 'wheel_road', 'yellow')),
    part('brick_2x4', [0, 5, 0], 'blue'),
    part('brick_2x4', [2, 5, 0], 'white'),
    part('brick_2x4', [4, 5, 0], 'blue'),
    part('brick_1x4', [0, 5, 5], 'blue'),
    part('brick_1x4', [5, 5, 5], 'blue'),
    part('cockpit', [1, 5, 5], 'white'),
    part('slope_long', [0, 5, 10], 'blue', 2),
    part('plate_2x4', [2, 5, 10], 'white'),
    part('slope_long', [4, 5, 10], 'blue', 2),
    part('spoiler', [0, 8, 0], 'blue'),
  ]
}

function buggyParts(catalog: PartCatalog): NewPart[] {
  const beams: V3I[] = [[0, 0, 1], [0, 0, 10]]
  return [
    part('axle_beam', beams[0]!, 'black'),
    part('axle_beam', beams[1]!, 'black'),
    part('chassis_short', [1, 3, 0], 'grey'),
    ...beams.flatMap(b => [
      wheelAt(catalog, 'axle_beam', b, 'neg', 'wheel_offroad', 'yellow'),
      wheelAt(catalog, 'axle_beam', b, 'pos', 'wheel_offroad', 'yellow'),
    ]),
    part('brick_2x4', [1, 5, 0], 'orange'),
    part('brick_2x4', [5, 5, 0], 'orange'),
    part('brick_1x4', [1, 5, 4], 'orange'),
    part('brick_1x4', [6, 5, 4], 'orange'),
    part('cockpit', [2, 5, 4], 'teal'),
    part('slope_long', [1, 5, 10], 'orange', 2),
    part('plate_2x4', [3, 5, 10], 'teal'),
    part('slope_long', [5, 5, 10], 'orange', 2),
    part('bumper', [1, 8, 3], 'teal'),
  ]
}

export function buildStarter(id: StarterInfo['id'], ctx: EditContext = defaultContext): CarDocument {
  const info = STARTERS.find(s => s.id === id)!
  let doc: CarDocument = { ...createEmptyDoc(ctx, info.name), starterId: id }
  const parts = id === 'racer' ? racerParts(ctx.catalog) : buggyParts(ctx.catalog)

  for (const p of parts) {
    const result = addParts(doc, [p], ctx)
    if (!result.ok)
      throw new Error(`Starter ${id} could not place ${p.defId} at ${p.pos.join(',')}: ${result.issues.map(i => i.message).join(' ')}`)
    doc = result.doc
  }

  // Explicit roles. Front wheels steer and every wheel brakes. Racer drives the rear, Buggy drives all four.
  const set = placeAll(doc.instances, ctx.catalog)
  const fOf = (g: CarDocument['wheelGroups'][number]) => hubCoordinates(set, g.instanceIds[0]!, doc.forward)?.f ?? 0
  const frontF = Math.max(...doc.wheelGroups.map(fOf))
  for (const g of doc.wheelGroups) {
    const front = fOf(g) === frontF
    const result = setWheelRoles(doc, g.id, {
      steering: front,
      braking: true,
      driven: id === 'buggy' ? true : !front,
      steerDirection: 1,
    }, ctx)
    if (!result.ok)
      throw new Error(`Starter ${id} role assignment failed`)
    doc = result.doc
  }
  return { ...doc, parentRevisionId: null }
}
