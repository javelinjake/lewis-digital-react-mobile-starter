import type { EditContext } from '@/game/build/doc'
import type { CarDocument } from '@/game/build/types'
import { describe, expect, it } from 'vitest'
import { findPlacements } from '@/game/build/candidates'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { addParts } from '@/game/build/edit'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { assessDrive } from '@/game/vehicle/analysis'
import { compileVehicle } from '@/game/vehicle/compile'
import { flatEnv, GAS, IDLE, makeSim, run } from './sim-helpers'

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok)
    throw new Error(JSON.stringify(r))
  return r as Extract<T, { ok: true }>
}

/** Chassis on `axles` axle beams (two wheels each), plus optional extra mounts for odd wheel counts. */
function wheeledCar(c: EditContext, axles: number[]): CarDocument {
  let doc = createEmptyDoc(c)
  doc = ok(addParts(doc, [{ defId: 'chassis_long', pos: [1, 3, 0], rot: 0, colour: 'grey' }], c)).doc
  for (const z of axles) {
    doc = ok(addParts(doc, [{ defId: 'axle_beam', pos: [0, 0, z], rot: 0, colour: 'black' }], c)).doc
    const spots = findPlacements(doc, catalog.get('wheel_road')!, { rotations: [0, 1, 2, 3] }, c).filter(k => Math.abs(k.pos[2] - z) <= 3)
    doc = ok(addParts(doc, spots.map(k => ({ defId: 'wheel_road', pos: k.pos, rot: k.rot, colour: 'yellow' })), c)).doc
  }
  return doc
}

function bigCar(c: EditContext, parts: number): CarDocument {
  let doc = ok(addParts(createEmptyDoc(c), [{ defId: 'chassis_long', pos: [1, 3, 0], rot: 0, colour: 'grey' }, { defId: 'wheel_mount', pos: [1, 0, 1], rot: 0, colour: 'black' }, { defId: 'wheel_mount', pos: [5, 0, 1], rot: 0, colour: 'black' }, { defId: 'wheel_mount', pos: [1, 0, 19], rot: 0, colour: 'black' }, { defId: 'wheel_mount', pos: [5, 0, 19], rot: 0, colour: 'black' }], c)).doc
  for (const m of doc.instances.filter(i => i.defId === 'wheel_mount')) {
    const side = m.pos[0] === 1 ? 'neg' : 'pos'
    const wanted = findPlacements(doc, catalog.get('wheel_road')!, { rotations: [0, 1, 2, 3] }, c).find(k => (side === 'neg' ? k.pos[0] < 1 : k.pos[0] >= 6) && Math.abs(k.pos[2] - (m.pos[2] - 1)) <= 1)
    if (wanted)
      doc = ok(addParts(doc, [{ defId: 'wheel_road', pos: wanted.pos, rot: wanted.rot, colour: 'yellow' }], c)).doc
  }
  // Fill the deck with 2x2 bricks, layer by layer (3 plates per layer so each stacks on the last), until the target part count is reached.
  const instances = [...doc.instances]
  let y = 5
  while (instances.length < parts && y < 60) {
    for (let x = 1; x < 7 && instances.length < parts; x += 2) {
      for (let z = 0; z < 22 && instances.length < parts; z += 2) {
        instances.push({ id: `fill${instances.length}`, defId: 'brick_2x2', defVersion: 1, pos: [x, y, z], rot: 0, colour: 'red' })
      }
    }
    y += 3
  }
  // Rebuild connections from geometry so the whole stack is one assembly.
  const base = { ...doc, instances }
  return ok(addParts({ ...base, instances: [...instances] }, [], c)).doc
}

describe('capacity and stability', () => {
  it('compiles and drives a 500-part car without truncating it', async () => {
    const c = sequentialContext('b')
    const doc = bigCar(c, 500)
    expect(doc.instances.length).toBeGreaterThanOrEqual(500)
    const t0 = performance.now()
    const a = assessDrive(doc, catalog)
    const compileMs = performance.now() - t0
    expect(a.blocks).toHaveLength(0)
    expect(a.spec!.partCount).toBeGreaterThanOrEqual(500)
    expect(a.spec!.colliders.length).toBeLessThan(a.spec!.partCount)
    expect(Number.isFinite(a.spec!.mass)).toBe(true)
    const { sim } = await makeSim(doc, flatEnv())
    const s0 = performance.now()
    run(sim, 2, GAS)
    const perTick = (performance.now() - s0) / 120
    expect(Number.isFinite(sim.state.pos[1])).toBe(true)
    // Development-machine figures only (not a device measurement).
    console.warn(`STRESS 500 parts: compile ${compileMs.toFixed(0)} ms, colliders ${a.spec!.colliders.length}, mass ${a.spec!.mass.toFixed(1)} kg, ${perTick.toFixed(2)} ms/tick`)
    expect(perTick).toBeLessThan(16)
  }, 60000)

  for (const [label, axles, wheels] of [['two-wheel', [2], 2], ['four-wheel', [2, 17], 4], ['six-wheel', [2, 9, 17], 6], ['eight-wheel', [1, 6, 11, 16], 8]] as const) {
    it(`${label} car runs stably`, async () => {
      const doc = wheeledCar(sequentialContext('w'), [...axles])
      const { sim, spec } = await makeSim(doc, flatEnv())
      expect(spec.wheels).toHaveLength(wheels)
      run(sim, 3, GAS)
      for (const v of [...sim.state.pos, ...sim.state.vel])
        expect(Number.isFinite(v)).toBe(true)
      expect(sim.state.pos[1]).toBeGreaterThan(-1)
      expect(sim.state.speed).toBeLessThan(15)
    })
  }

  it('one-wheel and three-wheel cars may topple but stay finite and playable', async () => {
    const c = sequentialContext('o')
    let doc = ok(addParts(createEmptyDoc(c), [{ defId: 'chassis_short', pos: [0, 3, 0], rot: 0, colour: 'grey' }, { defId: 'wheel_mount', pos: [0, 0, 6], rot: 0, colour: 'black' }], c)).doc
    const one = findPlacements(doc, catalog.get('wheel_road')!, { rotations: [0, 1, 2, 3] }, c)[0]!
    doc = ok(addParts(doc, [{ defId: 'wheel_road', pos: one.pos, rot: one.rot, colour: 'yellow' }], c)).doc
    expect(compileVehicle(doc, catalog).ok).toBe(true)
    const { sim } = await makeSim(doc, flatEnv())
    run(sim, 4, GAS)
    expect(Number.isFinite(sim.state.pos[1])).toBe(true)

    const racer = buildStarter('racer', sequentialContext('t'))
    const three = { ...racer, instances: racer.instances.filter(i => i.defId !== 'wheel_road' || i.pos[0] !== 6 || i.pos[2] !== 0) }
    const a = assessDrive(three, catalog)
    expect(a.blocks).toHaveLength(0)
    const t = await makeSim(three, flatEnv())
    run(t.sim, 3, GAS)
    expect(Number.isFinite(t.sim.state.pos[1])).toBe(true)
  })

  it('survives a long session with frequent resets and stays finite', async () => {
    const doc = buildStarter('racer', sequentialContext('l'))
    const { sim, pw, spec } = await makeSim(doc, flatEnv())
    const start = performance.now()
    for (let i = 0; i < 40; i++) {
      run(sim, 1.5, { steer: (i % 3) - 1, throttle: 1, brake: 0, reverse: false })
      const g = pw.groundAt(0, 0)!
      sim.reset({ pos: [0, g.y - spec.wheelBottomY + 0.03, 0], yaw: 0 })
      run(sim, 0.2, IDLE)
      expect(sim.state.speed).toBeLessThan(1)
    }
    expect(Number.isFinite(sim.state.pos[1])).toBe(true)
    console.warn(`STRESS 40 resets, 68 s simulated in ${(performance.now() - start).toFixed(0)} ms`)
  }, 120000)
})
