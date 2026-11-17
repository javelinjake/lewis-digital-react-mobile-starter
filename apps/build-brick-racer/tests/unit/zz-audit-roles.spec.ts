import { describe, expect, it } from 'vitest'
import { findPlacements } from '@/game/build/candidates'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { addParts, setForward } from '@/game/build/edit'
import { catalog } from '@/game/catalog/catalog'
import { compileVehicle } from '@/game/vehicle/compile'

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok)
    throw new Error(`expected ok: ${JSON.stringify(r)}`)
  return r as Extract<T, { ok: true }>
}

function axleCar() {
  const c = sequentialContext('a')
  let doc = createEmptyDoc(c)
  doc = ok(addParts(doc, [{ defId: 'chassis_long', pos: [1, 3, 0], rot: 0, colour: 'grey' }], c)).doc
  for (const z of [1, 19]) {
    doc = ok(addParts(doc, [{ defId: 'axle_beam', pos: [0, 0, z], rot: 0, colour: 'black' }], c)).doc
    const spots = findPlacements(doc, catalog.get('wheel_road')!, { rotations: [0, 1, 2, 3] }, c).filter(k => k.pos[2] >= z - 3 && k.pos[2] <= z + 3)
    doc = ok(addParts(doc, spots.map(k => ({ defId: 'wheel_road', pos: k.pos, rot: k.rot, colour: 'yellow' })), c)).doc
  }
  return { doc, c }
}

describe('default roles follow forward direction', () => {
  it('steering wheels are the front axle after switching forward to z-', () => {
    const { doc, c } = axleCar()
    const a = compileVehicle(doc, catalog)
    if (!a.ok) throw new Error('x')
    expect(a.spec.wheels.filter(w => w.steering).every(w => w.pos[2] > 0)).toBe(true)
    const flipped = ok(setForward(doc, 'z-', c)).doc
    const b = compileVehicle(flipped, catalog)
    if (!b.ok) throw new Error('x')
    // In the body frame the steering wheels must still be at the front (+Z)
    console.log(JSON.stringify(flipped.wheelGroups.map(g => ({ s: g.steering, d: g.driven, u: g.userRoles }))), b.spec.wheels.map(w => [w.pos[2].toFixed(2), w.steering]))
    expect(b.spec.wheels.filter(w => w.steering).every(w => w.pos[2] > 0)).toBe(true)
  })
})
