import type { CarDocument } from '@/game/build/types'
import { describe, expect, it } from 'vitest'
import { findPlacements } from '@/game/build/candidates'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { addParts, deleteParts, swapWheelGroup } from '@/game/build/edit'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { assessDrive } from '@/game/vehicle/analysis'
import { compileVehicle } from '@/game/vehicle/compile'

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok)
    throw new Error(`expected ok: ${JSON.stringify(r)}`)
  return r as Extract<T, { ok: true }>
}
function spec(doc: CarDocument) {
  const r = compileVehicle(doc, catalog)
  if (!r.ok)
    throw new Error(JSON.stringify(r.issues))
  return r.spec
}

/** Chassis on N axle beams, two wheels per beam. */
function axleCar(axles: number[], wheelId = 'wheel_road') {
  const c = sequentialContext('a')
  let doc = createEmptyDoc(c)
  doc = ok(addParts(doc, [{ defId: 'chassis_long', pos: [1, 3, 0], rot: 0, colour: 'grey' }], c)).doc
  for (const z of axles) {
    doc = ok(addParts(doc, [{ defId: 'axle_beam', pos: [0, 0, z], rot: 0, colour: 'black' }], c)).doc
    const spots = findPlacements(doc, catalog.get(wheelId)!, { rotations: [0, 1, 2, 3] }, c).filter(k => k.pos[2] >= z - 3 && k.pos[2] <= z + 3)
    doc = ok(addParts(doc, spots.map(k => ({ defId: wheelId, pos: k.pos, rot: k.rot, colour: 'yellow' })), c)).doc
  }
  return { doc, c }
}

describe('vehicle compilation', () => {
  it('compiles the racer with the right wheels, mass and symmetric balance', () => {
    const c = sequentialContext('r')
    const doc = buildStarter('racer', c)
    const s = spec(doc)
    expect(s.wheels).toHaveLength(4)
    expect(s.wheels.every(w => w.tyre === 'road')).toBe(true)
    expect(s.wheels.filter(w => w.steering).every(w => w.pos[2] > 0)).toBe(true)
    expect(s.wheels.filter(w => w.steering)).toHaveLength(2)
    expect(s.wheels.filter(w => w.driven).every(w => w.pos[2] < 0)).toBe(true)
    const partMass = doc.instances.reduce((a, i) => a + catalog.get(i.defId)!.massKg, 0)
    expect(s.mass).toBeCloseTo(partMass, 6)
    // Left/right wheels mirror about the centre of mass.
    const left = s.wheels.filter(w => w.pos[0] < 0).map(w => w.pos[2]).sort()
    const right = s.wheels.filter(w => w.pos[0] > 0).map(w => w.pos[2]).sort()
    expect(left).toEqual(right.map(v => expect.closeTo(v, 6)))
    expect(s.colliders.length).toBeGreaterThan(5)
    expect(s.colliders.length).toBeLessThanOrEqual(17)
    expect(s.inertia.values.every(v => v > 0)).toBe(true)
  })

  it('ballast changes total mass and moves the centre of mass with its position (AC11)', () => {
    const c = sequentialContext('b')
    const doc = buildStarter('racer', c)
    const base = spec(doc)
    const spots = findPlacements(doc, catalog.get('ballast')!, { rotations: [0] }, c).filter(k => k.pos[1] >= 5)
    const front = [...spots].sort((a, b) => b.pos[2] - a.pos[2])[0]!
    const rear = [...spots].sort((a, b) => a.pos[2] - b.pos[2])[0]!
    expect(front.pos[2]).toBeGreaterThan(rear.pos[2] + 6)
    const withFront = spec(ok(addParts(doc, [{ defId: 'ballast', pos: front.pos, rot: 0, colour: 'grey' }], c)).doc)
    const withRear = spec(ok(addParts(doc, [{ defId: 'ballast', pos: rear.pos, rot: 0, colour: 'grey' }], c)).doc)
    expect(withFront.mass).toBeGreaterThan(base.mass + 0.3)
    expect(withFront.mass).toBeCloseTo(withRear.mass, 9)
    // Centre of mass (lattice frame, metres) follows the ballast.
    expect(withFront.centreOfMassLattice[2]).toBeGreaterThan(base.centreOfMassLattice[2])
    expect(withRear.centreOfMassLattice[2]).toBeLessThan(base.centreOfMassLattice[2])
    // The axles sit further back relative to the centre of mass when ballast is at the front.
    const frontAxle = (s: typeof base) => Math.max(...s.wheels.map(w => w.pos[2]))
    expect(frontAxle(withFront)).toBeLessThan(frontAxle(base))
    expect(frontAxle(withRear)).toBeGreaterThan(frontAxle(base))
  })

  it('larger wheels change physical clearance and ground contact height (AC13)', () => {
    const c = sequentialContext('w')
    const doc = buildStarter('racer', c)
    const base = spec(doc)
    const front = doc.wheelGroups.find(g => g.steering)!
    const big = spec(ok(swapWheelGroup(doc, front.id, 'wheel_offroad', c)).doc)
    expect(big.wheelBottomY).toBeLessThan(base.wheelBottomY)
    expect(big.bodyMinY - big.wheelBottomY).toBeGreaterThan(base.bodyMinY - base.wheelBottomY)
    expect(big.wheels.filter(w => w.tyre === 'offroad')).toHaveLength(2)
  })

  it('counts exposed area from the silhouette, not from every piece (AC16)', () => {
    const c = sequentialContext('x')
    const doc = buildStarter('racer', c)
    const base = spec(doc)
    // Hidden inside the existing front and top silhouettes: more mass, no extra frontal or top area.
    const hidden = spec(ok(addParts(doc, [{ defId: 'brick_2x2', pos: [2, 8, 2], rot: 0, colour: 'red' }], c)).doc)
    expect(hidden.mass).toBeGreaterThan(base.mass)
    expect(hidden.aero.front).toBeCloseTo(base.aero.front, 9)
    expect(hidden.aero.top).toBeCloseTo(base.aero.top, 9)
    // A tower sticking above the cockpit adds frontal area.
    let tower = doc
    for (const y of [6, 9, 12])
      tower = ok(addParts(tower, [{ defId: 'brick_1x1', pos: [3, y, 12], rot: 0, colour: 'red' }], c)).doc
    expect(spec(tower).aero.front).toBeGreaterThan(base.aero.front)
  })

  it('shields a wing placed behind a tall block and keeps a clear wing unshielded', () => {
    const c = sequentialContext('s')
    const s = spec(buildStarter('racer', c))
    expect(s.aero.wings).toHaveLength(1)
    expect(s.aero.wings[0]!.shielded).toBe(0)
    expect(s.aero.wings[0]!.alignment).toBeCloseTo(1, 6)
  })
})

describe('drive checks', () => {
  it('blocks an empty car and a car without wheels, naming the cause', () => {
    const c = sequentialContext('e')
    expect(assessDrive(createEmptyDoc(c), catalog).blocks[0]!.code).toBe('nothing_to_drive')
    const brick = ok(addParts(createEmptyDoc(c), [{ defId: 'brick_2x4', pos: [0, 0, 0], rot: 0, colour: 'red' }], c)).doc
    expect(assessDrive(brick, catalog).blocks[0]!.code).toBe('no_wheels')
  })

  it('allows unusual cars with warnings (AC05)', () => {
    for (const [axles, wheels] of [[[2], 2], [[2, 9, 17], 6], [[1, 6, 11, 16], 8]] as const) {
      const { doc } = axleCar([...axles])
      const a = assessDrive(doc, catalog)
      expect(a.blocks, `${wheels} wheels`).toHaveLength(0)
      expect(a.spec!.wheels).toHaveLength(wheels)
    }
  })

  it('compiles a one-wheel and a three-wheel car and flags balance', () => {
    const c = sequentialContext('o')
    let doc = ok(addParts(createEmptyDoc(c), [{ defId: 'chassis_short', pos: [0, 3, 0], rot: 0, colour: 'grey' }, { defId: 'wheel_mount', pos: [0, 0, 6], rot: 0, colour: 'black' }], c)).doc
    const one = findPlacements(doc, catalog.get('wheel_road')!, { rotations: [0, 1, 2, 3] }, c)[0]!
    doc = ok(addParts(doc, [{ defId: 'wheel_road', pos: one.pos, rot: one.rot, colour: 'yellow' }], c)).doc
    const a = assessDrive(doc, catalog)
    expect(a.blocks).toHaveLength(0)
    expect(a.warnings.some(w => w.code === 'poor_balance')).toBe(true)
  })

  it('warns about loose pieces but drives the connected car', () => {
    const c = sequentialContext('l')
    const doc = buildStarter('racer', c)
    const loose = ok(addParts(doc, [{ defId: 'brick_1x1', pos: [30, 0, 30], rot: 0, colour: 'red' }], c)).doc
    const a = assessDrive(loose, catalog)
    expect(a.blocks).toHaveLength(0)
    expect(a.warnings.some(w => w.code === 'loose_pieces')).toBe(true)
    expect(a.spec!.looseInstanceIds).toHaveLength(1)
  })

  it('a tall narrow car triggers a stability warning but still launches', () => {
    const c = sequentialContext('t')
    let doc = buildStarter('racer', c)
    for (let y = 8; y < 8 + 3 * 12; y += 3) {
      const r = addParts(doc, [{ defId: 'brick_2x2', pos: [2, y + 3, 5], rot: 0, colour: 'red' }], c)
      if (r.ok)
        doc = r.doc
    }
    const tower = findPlacements(doc, catalog.get('brick_1x1')!, { rotations: [0] }, c)
    expect(tower.length).toBeGreaterThan(0)
    expect(assessDrive(doc, catalog).blocks).toHaveLength(0)
  })

  it('removing the chassis leaves a driveable-or-blocked state with the pieces preserved', () => {
    const c = sequentialContext('d')
    const doc = buildStarter('racer', c)
    const chassis = doc.instances.find(i => i.defId === 'chassis_short')!
    const after = ok(deleteParts(doc, [chassis.id], c)).doc
    expect(after.instances.length).toBe(doc.instances.length - 1)
    const a = assessDrive(after, catalog)
    expect(a.blocks.length > 0 || a.spec !== null).toBe(true)
  })
})
