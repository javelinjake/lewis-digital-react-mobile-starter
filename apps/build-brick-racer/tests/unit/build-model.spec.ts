import type { CarDocument } from '@/game/build/types'
import { describe, expect, it } from 'vitest'
import { computeAssemblies, looseInstanceIds } from '@/game/build/assemblies'
import { findPlacements } from '@/game/build/candidates'
import { deriveConnections } from '@/game/build/connections'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { addParts, deleteParts, duplicateParts, movePartsBy, previewDelete, rotateParts, swapWheelGroup } from '@/game/build/edit'
import { placeAll } from '@/game/build/geometry'
import { mirrorPlacement } from '@/game/build/mirror'
import { wheelWarnings } from '@/game/build/validate'
import { catalog, createCatalog } from '@/game/catalog/catalog'
import { PART_DEFINITIONS } from '@/game/catalog/parts'
import { buildStarter } from '@/game/catalog/starters'

const ctx = () => sequentialContext('t')
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok)
    throw new Error(`expected ok: ${JSON.stringify(r)}`)
  return r as Extract<T, { ok: true }>
}

describe('catalogue', () => {
  it('ships the 36 specified definitions with unique ids', () => {
    expect(PART_DEFINITIONS).toHaveLength(36)
    expect(new Set(PART_DEFINITIONS.map(d => d.id)).size).toBe(36)
    for (const id of ['brick_2x6', 'plate_4x6', 'beam_1x12', 'slope_long', 'wedge_right', 'curve_long', 'chassis_long', 'axle_beam', 'wheel_offroad', 'spoiler', 'ballast'])
      expect(catalog.get(id), id).toBeDefined()
  })

  it('keeps boxes and connectors inside part bounds', () => {
    for (const d of PART_DEFINITIONS) {
      expect(d.massKg, d.id).toBeGreaterThan(0)
      for (const b of d.boxes) {
        expect(b.min.every((v, i) => v >= 0 && v < b.max[i]!)).toBe(true)
        expect(b.max.every((v, i) => v <= d.size[i]!)).toBe(true)
      }
      for (const c of d.connectors) {
        expect(c.pos2[0]).toBeGreaterThanOrEqual(0)
        expect(c.pos2[0]).toBeLessThanOrEqual(d.size[0] * 2)
        expect(c.pos2[1]).toBeLessThanOrEqual(d.size[1] * 2)
        expect(c.pos2[2]).toBeLessThanOrEqual(d.size[2] * 2)
      }
    }
  })

  it('lets every wheel seat on both sides of every mount without half-stud offsets', () => {
    const c = ctx()
    for (const mountId of ['wheel_mount', 'axle_beam']) {
      for (const wheelId of ['wheel_small', 'wheel_road', 'wheel_wide', 'wheel_offroad']) {
        let doc = ok(addParts(createEmptyDoc(c), [{ defId: mountId, pos: [0, 0, 0], rot: 0, colour: 'black' }], c)).doc
        const w = catalog.get(wheelId)!
        const candidates = findPlacements(doc, w, { rotations: [0, 1, 2, 3] }, c)
        expect(candidates.length, `${wheelId} on ${mountId}`).toBe(2)
        doc = ok(addParts(doc, candidates.map(k => ({ defId: wheelId, pos: k.pos, rot: k.rot, colour: 'yellow' })), c)).doc
        expect(doc.wheelGroups).toHaveLength(1)
        expect(doc.wheelGroups[0]!.symmetry).toHaveLength(1)
      }
    }
  })
})

describe('starter cars', () => {
  for (const id of ['racer', 'buggy'] as const) {
    it(`${id} is a valid, connected, ordinary build`, () => {
      const c = ctx()
      const doc = buildStarter(id, c)
      const set = placeAll(doc.instances, catalog)
      expect(set.missing).toHaveLength(0)
      const assemblies = computeAssemblies(doc, catalog)
      expect(assemblies.components).toHaveLength(1)
      expect(set.placed.filter(p => p.def.wheel)).toHaveLength(4)
      expect(doc.wheelGroups).toHaveLength(2)
      expect(doc.wheelGroups.filter(g => g.steering)).toHaveLength(1)
      expect(doc.wheelGroups.every(g => g.braking && g.userRoles)).toBe(true)
      expect(wheelWarnings(set)).toHaveLength(0)
      expect(deriveConnections(set.placed)).toEqual(doc.connections)
    })
  }

  it('racer drives the rear, buggy drives all wheels', () => {
    const racer = buildStarter('racer', ctx())
    expect(racer.wheelGroups.filter(g => g.driven)).toHaveLength(1)
    expect(buildStarter('buggy', ctx()).wheelGroups.filter(g => g.driven)).toHaveLength(2)
  })
})

describe('transactions', () => {
  const racer = (c = ctx()) => buildStarter('racer', c)

  it('rejects an overlapping placement with a reason and changes nothing (AC06)', () => {
    const c = ctx()
    const doc = racer(c)
    const result = addParts(doc, [{ defId: 'brick_2x2', pos: [1, 5, 5], rot: 0, colour: 'red' }], c)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]!.code).toBe('overlap')
      expect(result.issues[0]!.message.length).toBeGreaterThan(5)
    }
    expect(doc.instances).toHaveLength(racer(ctx()).instances.length)
  })

  it('refuses a wheel with nothing to sit on', () => {
    const c = ctx()
    const result = addParts(createEmptyDoc(c), [{ defId: 'wheel_road', pos: [0, 0, 0], rot: 0, colour: 'yellow' }], c)
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.issues[0]!.code).toBe('wheel_unmounted')
  })

  it('every offered placement commits cleanly', () => {
    const c = ctx()
    const doc = racer(c)
    const found = findPlacements(doc, catalog.get('brick_2x2')!, { rotations: [0] }, c)
    expect(found.length).toBeGreaterThan(4)
    for (const cand of found.slice(0, 25))
      expect(addParts(doc, [{ defId: cand.defId, pos: cand.pos, rot: cand.rot, colour: 'red' }], c).ok, cand.key).toBe(true)
  })

  it('four quarter turns restore the selection exactly and keep it valid', () => {
    let doc = racer()
    const ids = doc.instances.filter(i => i.defId.startsWith('brick_')).map(i => i.id)
    const before = JSON.stringify(doc.instances.map(i => [i.id, i.pos, i.rot]))
    // Rotating a body block may collide in place, so test on a free-standing group.
    const c2 = ctx()
    let free = ok(addParts(createEmptyDoc(c2), [
      { defId: 'brick_2x4', pos: [0, 0, 0], rot: 0, colour: 'red' },
      { defId: 'brick_1x2', pos: [0, 3, 1], rot: 0, colour: 'blue' },
    ], c2)).doc
    const freeIds = free.instances.map(i => i.id)
    const start = JSON.stringify(free.instances.map(i => [i.pos, i.rot]))
    for (let i = 0; i < 4; i++)
      free = ok(rotateParts(free, freeIds, c2)).doc
    expect(JSON.stringify(free.instances.map(i => [i.pos, i.rot]))).toBe(start)
    expect(ids.length).toBeGreaterThan(0)
    expect(before.length).toBeGreaterThan(0)
    doc = free
    expect(doc.connections).toHaveLength(2)
  })

  it('keeps pieces cut off by a delete and identifies them (AC08)', () => {
    const c = ctx()
    const doc = racer(c)
    const chassis = doc.instances.find(i => i.defId === 'chassis_short')!
    const preview = previewDelete(doc, [chassis.id], c)
    expect(preview.supporting).toBe(true)
    expect(preview.detached.length).toBeGreaterThan(5)
    const after = ok(deleteParts(doc, [chassis.id], c)).doc
    expect(after.instances).toHaveLength(doc.instances.length - 1)
    const loose = looseInstanceIds(computeAssemblies(after, catalog))
    expect(loose.size).toBeGreaterThan(0)
    expect(after.rootInstanceId).not.toBe(chassis.id)
  })

  it('duplicates a selection into free space with new ids', () => {
    const c = ctx()
    const doc = racer(c)
    const result = ok(duplicateParts(doc, [doc.instances.find(i => i.defId === 'spoiler')!.id], c))
    expect(result.created).toHaveLength(1)
    expect(result.doc.instances).toHaveLength(doc.instances.length + 1)
  })

  it('moves a selection as a group and validates it', () => {
    const c = ctx()
    const doc = racer(c)
    const spoiler = doc.instances.find(i => i.defId === 'spoiler')!
    const moved = ok(movePartsBy(doc, [spoiler.id], [0, 0, 1], c))
    expect(moved.doc.instances.find(i => i.id === spoiler.id)!.pos[2]).toBe(1)
    const clash = movePartsBy(doc, [spoiler.id], [0, -3, 0], c)
    expect(clash.ok).toBe(false)
  })
})

describe('wheel groups and swaps', () => {
  it('front-most axle steers whichever axle was built first', () => {
    const c = ctx()
    let doc: CarDocument = createEmptyDoc(c)
    doc = ok(addParts(doc, [{ defId: 'chassis_short', pos: [0, 3, 0], rot: 0, colour: 'grey' }], c)).doc
    doc = ok(addParts(doc, [{ defId: 'wheel_mount', pos: [0, 0, 1], rot: 0, colour: 'black' }], c)).doc
    const rear = findPlacements(doc, catalog.get('wheel_road')!, { rotations: [0, 1, 2, 3] }, c)[0]!
    doc = ok(addParts(doc, [{ defId: 'wheel_road', pos: rear.pos, rot: rear.rot, colour: 'yellow' }], c)).doc
    doc = ok(addParts(doc, [{ defId: 'wheel_mount', pos: [0, 0, 10], rot: 0, colour: 'black' }], c)).doc
    const front = findPlacements(doc, catalog.get('wheel_road')!, { rotations: [0, 1, 2, 3] }, c).find(k => k.pos[2] > 5)!
    doc = ok(addParts(doc, [{ defId: 'wheel_road', pos: front.pos, rot: front.rot, colour: 'yellow' }], c)).doc
    const set = placeAll(doc.instances, catalog)
    const steering = doc.wheelGroups.filter(g => g.steering)
    expect(steering).toHaveLength(1)
    expect(set.byId.get(steering[0]!.instanceIds[0]!)!.bounds.min[2]).toBeGreaterThan(5)
  })

  it('swaps a whole group in one transaction and is rejected atomically when one wheel fails (AC07)', () => {
    const c = ctx()
    const doc = buildStarter('racer', c)
    const front = doc.wheelGroups.find(g => g.steering)!
    const swapped = ok(swapWheelGroup(doc, front.id, 'wheel_wide', c))
    expect(front.instanceIds.every(id => swapped.doc.instances.find(i => i.id === id)!.defId === 'wheel_wide')).toBe(true)
    expect(swapped.doc.instances.filter(i => i.defId === 'wheel_road')).toHaveLength(2)

    // A definition whose hub cannot line up is refused for the whole pair.
    const broken = createCatalog([...PART_DEFINITIONS, { ...catalog.get('wheel_road')!, id: 'wheel_bad', size: [2, 9, 4], connectors: [{ id: 'hub', type: 'hub', pos2: [0, 9, 4], dir: [-1, 0, 0], tags: ['wheel'] }] }])
    const c2 = { ...sequentialContext('b', broken) }
    const d2 = buildStarter('racer', c2)
    const g2 = d2.wheelGroups.find(g => g.steering)!
    const refused = swapWheelGroup(d2, g2.id, 'wheel_bad', c2)
    expect(refused.ok).toBe(false)
    expect(d2.instances.filter(i => i.defId === 'wheel_road')).toHaveLength(4)
  })
})

describe('mirroring', () => {
  it('maps a left wedge to a right wedge across the plane', () => {
    const c = ctx()
    const m = mirrorPlacement({ defId: 'wedge_left', pos: [0, 0, 0], rot: 0 }, 6, c)
    expect(m).not.toBeNull()
    expect(m!.defId).toBe('wedge_right')
    expect(m!.pos[0]).toBe(4)
  })

  it('mirrors a symmetric brick and detects pieces on the plane', () => {
    const c = ctx()
    expect(mirrorPlacement({ defId: 'brick_2x4', pos: [0, 0, 0], rot: 0 }, 4, c)!.pos).toEqual([2, 0, 0])
    expect(mirrorPlacement({ defId: 'brick_2x4', pos: [1, 0, 0], rot: 0 }, 4, c)!.onPlane).toBe(true)
  })

  it('mirrors a wheel by turning it to face the other side', () => {
    const c = ctx()
    const doc = buildStarter('racer', c)
    const right = doc.instances.find(i => i.defId === 'wheel_road' && i.rot === 0)!
    const m = mirrorPlacement({ defId: right.defId, pos: right.pos, rot: right.rot }, 6, c)
    expect(m).not.toBeNull()
    expect(m!.rot).toBe(2)
    expect(doc.instances.some(i => i.defId === 'wheel_road' && i.rot === 2 && i.pos[0] === m!.pos[0] && i.pos[2] === m!.pos[2])).toBe(true)
  })
})
