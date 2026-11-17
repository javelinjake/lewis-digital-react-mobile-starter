import type { CarDocument, Forward } from '@/game/build/types'
import { describe, expect, it } from 'vitest'
import { findPlacements } from '@/game/build/candidates'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { addParts, setForward } from '@/game/build/edit'
import { catalog } from '@/game/catalog/catalog'
import { compileVehicle } from '@/game/vehicle/compile'
import { flatEnv, makeSim, run } from './sim-helpers'

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`)
  return r as Extract<T, { ok: true }>
}
function axleCar(axles: number[], wheelIds: string[]) {
  const c = sequentialContext('a')
  let doc = createEmptyDoc(c)
  doc = ok(addParts(doc, [{ defId: 'chassis_long', pos: [1, 3, 0], rot: 0, colour: 'grey' }], c)).doc
  let i = 0
  for (const z of axles) {
    doc = ok(addParts(doc, [{ defId: 'axle_beam', pos: [0, 0, z], rot: 0, colour: 'black' }], c)).doc
    const wheelId = wheelIds[i++ % wheelIds.length]!
    const spots = findPlacements(doc, catalog.get(wheelId)!, { rotations: [0, 1, 2, 3] }, c).filter(k => k.pos[2] >= z - 3 && k.pos[2] <= z + 3)
    doc = ok(addParts(doc, spots.map(k => ({ defId: wheelId, pos: k.pos, rot: k.rot, colour: 'yellow' })), c)).doc
  }
  return { doc, c }
}
const finite = (v: readonly number[]) => v.every(Number.isFinite)

describe('weird cars stay finite', () => {
  const cases: Array<[string, number[], string[]]> = [
    ['8 wheels mixed', [0, 6, 12, 18], ['wheel_small', 'wheel_offroad', 'wheel_wide', 'wheel_road']],
    ['2 wheels', [8], ['wheel_road']],
    ['2 axles small/offroad', [1, 19], ['wheel_small', 'wheel_offroad']],
  ]
  for (const [name, axles, wheels] of cases) {
    for (const fwd of ['z+', 'z-', 'x+', 'x-'] as Forward[]) {
      it(`${name} facing ${fwd}`, async () => {
        const { doc, c } = axleCar(axles, wheels)
        const d: CarDocument = ok(setForward(doc, fwd, c)).doc
        const comp = compileVehicle(d, catalog)
        if (!comp.ok) throw new Error(JSON.stringify(comp.issues))
        const { sim } = await makeSim(d, flatEnv(), { assist: 'light' })
        for (let i = 0; i < 600; i++) {
          sim.step({ steer: Math.sin(i / 40), throttle: i % 200 < 150 ? 1 : 0, brake: i % 200 > 170 ? 1 : 0, reverse: i > 400 }, true)
          const s = sim.state
          if (!finite([...s.pos, ...s.quat, ...s.vel, ...s.angVel])) throw new Error(`non-finite at ${i}`)
        }
        expect(sim.state.pos[1]).toBeGreaterThan(-1)
      })
    }
  }
})
