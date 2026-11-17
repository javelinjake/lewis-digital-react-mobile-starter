import type { CarDocument } from '@/game/build/types'
import { describe, expect, it } from 'vitest'
import { findPlacements } from '@/game/build/candidates'
import { sequentialContext } from '@/game/build/doc'
import { addParts, setWheelRoles } from '@/game/build/edit'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { flatEnv, GAS, IDLE, makeSim, run, slab } from './sim-helpers'

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok)
    throw new Error(`expected ok: ${JSON.stringify(r)}`)
  return r as Extract<T, { ok: true }>
}

async function timeToSpeed(doc: CarDocument, target: number, surface: 'plastic' | 'mud' | 'tile' = 'plastic') {
  const { sim } = await makeSim(doc, flatEnv([], surface))
  for (let i = 0; i < 60 * 12; i++) {
    sim.step(GAS, true)
    if (sim.state.forwardSpeed >= target)
      return i / 60
  }
  return Infinity
}

function withBallast(doc: CarDocument, c: ReturnType<typeof sequentialContext>, count: number): CarDocument {
  let d = doc
  for (let n = 0; n < count; n++) {
    // Low and central: lowest free spot nearest the car's centre line, so the comparison is about mass not balance.
    const spot = findPlacements(d, catalog.get('ballast')!, { rotations: [0] }, c)
      .filter(k => k.pos[1] >= 5)
      .sort((a, b) => a.pos[1] - b.pos[1] || Math.abs(a.pos[0] - 2) - Math.abs(b.pos[0] - 2) || a.pos[2] - b.pos[2])[0]!
    d = ok(addParts(d, [{ defId: 'ballast', pos: spot.pos, rot: 0, colour: 'grey' }], c)).doc
  }
  return d
}

describe('physics behaviour driven by the build', () => {
  it('adding substantial mass reduces powered acceleration under equal grip and motor (AC12)', async () => {
    const c = sequentialContext('m')
    const light = buildStarter('racer', c)
    const heavy = withBallast(light, c, 4)
    const tLight = await timeToSpeed(light, 2.5)
    const tHeavy = await timeToSpeed(heavy, 2.5)
    expect(tHeavy).toBeGreaterThan(tLight * 1.25)
  })

  it('wheel count changes traction but not total motor output (AC14)', async () => {
    const c = sequentialContext('d')
    const rwd = buildStarter('racer', c)
    const front = rwd.wheelGroups.find(g => g.steering)!
    const awd = ok(setWheelRoles(rwd, front.id, { driven: true }, c)).doc
    const plasticAwd = await timeToSpeed(awd, 2, 'plastic')
    const plasticRwd = await timeToSpeed(rwd, 2, 'plastic')
    const mudAwd = await timeToSpeed(awd, 0.8, 'mud')
    const mudRwd = await timeToSpeed(rwd, 0.8, 'mud')
    // Grippy surface: same shared motor output, so about the same time (not twice as fast).
    expect(Math.abs(plasticAwd - plasticRwd) / plasticRwd).toBeLessThan(0.25)
    // Slippery surface: more driven wheels put the same output through more contact patches.
    expect(mudAwd).toBeLessThan(mudRwd)
  })

  it('each wheel uses the surface under it (AC15)', async () => {
    const c = sequentialContext('f')
    const doc = buildStarter('racer', c)
    const env = flatEnv([{ id: 'mudstrip', centre: [3, 0.0, 0], half: [3, 0.0005, 200], surface: 'mud', kind: 'ground' }])
    // Mud on +X side only, raised a hair so it wins the ray test where it exists.
    const { sim, spec } = await makeSim(doc, env, { pos: [0, 0.4, 0] })
    run(sim, 2, IDLE)
    const surfaces = sim.state.wheels.map((w, i) => ({ x: spec.wheels[i]!.pos[0], s: w.surface }))
    expect(new Set(surfaces.map(s => s.s))).toEqual(new Set(['tile', 'mud']))
    for (const s of surfaces)
      expect(s.s).toBe(s.x > 0 ? 'mud' : 'tile')
  })

  it('larger exposed area produces more drag (AC16)', async () => {
    const c = sequentialContext('g')
    const doc = buildStarter('racer', c)
    const coast = async (mult: number) => {
      const { sim, spec } = await makeSim(doc, flatEnv())
      run(sim, 4, GAS)
      spec.aero.front *= mult
      spec.aero.side *= mult
      spec.aero.top *= mult
      const z0 = sim.state.pos[2]
      const v0 = sim.state.forwardSpeed
      run(sim, 3, IDLE, false)
      return { dz: sim.state.pos[2] - z0, v0, v1: sim.state.forwardSpeed }
    }
    const base = await coast(1)
    const big = await coast(6)
    expect(big.v1).toBeLessThan(base.v1)
    expect(big.dz).toBeLessThan(base.dz)
  })

  it('brakes through tyre grip, shorter on grippier surfaces, and reverses only after a sustained brake at standstill', async () => {
    const c = sequentialContext('b')
    const doc = buildStarter('racer', c)
    const stop = async (surface: 'plastic' | 'tile') => {
      const { sim } = await makeSim(doc, flatEnv([], surface))
      run(sim, 5, GAS)
      const v = sim.state.forwardSpeed
      const z0 = sim.state.pos[2]
      let t = 0
      let dist = 0
      let stoppedAt = -1
      for (let i = 0; i < 60 * 4; i++) {
        sim.step({ steer: 0, throttle: 0, brake: 1, reverse: false }, true)
        if (stoppedAt < 0 && sim.state.speed < 0.1) {
          stoppedAt = i / 60
          dist = sim.state.pos[2] - z0
        }
        t = i
      }
      return { v, dist, stoppedAt, reversing: sim.state.reversing, finalSpeed: sim.state.forwardSpeed, t }
    }
    const grip = await stop('plastic')
    const tile = await stop('tile')
    expect(grip.stoppedAt).toBeGreaterThan(0)
    expect(grip.dist).toBeGreaterThan(0)
    expect(grip.dist).toBeLessThan(tile.dist)
    // After holding brake at standstill the car starts backing up.
    expect(grip.reversing).toBe(true)
    expect(grip.finalSpeed).toBeLessThan(-0.5)
  })

  it('rolls downhill by gravity with the motor disabled, without a heavy-car speed bonus', async () => {
    const c = sequentialContext('r')
    const light = buildStarter('racer', c)
    const heavy = withBallast(light, c, 4)
    const ramp = slab('ramp', [0, 0, 8], [4, 0.1, 9], 'plastic', (10 * Math.PI) / 180)
    const roll = async (doc: CarDocument) => {
      const { sim } = await makeSim(doc, flatEnv([ramp]), { pos: [0, 1.6, 0], yaw: 0 })
      run(sim, 3.5, IDLE, false)
      return sim.state.forwardSpeed
    }
    const vl = await roll(light)
    const vh = await roll(heavy)
    expect(vl).toBeGreaterThan(0.5)
    expect(Math.abs(vh - vl) / vl).toBeLessThan(0.15)
  })
})
