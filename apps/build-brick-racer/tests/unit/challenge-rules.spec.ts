import type { ChallengeId } from '@/game/challenges/types'
import type { V3 } from '@/game/math'
import type { DriveInput } from '@/game/vehicle/input'
import type { SimEvent, VehicleState } from '@/game/vehicle/sim'
import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { ENVIRONMENTS, getChallenge } from '@/game/challenges'
import { evaluateRun } from '@/game/challenges/eval'
import { ChallengeRun } from '@/game/challenges/run'
import { DriveSession } from '@/game/session'
import { compileVehicle } from '@/game/vehicle/compile'
import { emptyControls } from '@/game/vehicle/input'
import { loadRapier } from '@/game/vehicle/rapier'
import { PhysicsWorld } from '@/game/vehicle/world'

const spec = (() => {
  const r = compileVehicle(buildStarter('racer', sequentialContext('x')), catalog)
  if (!r.ok)
    throw new Error('compile')
  return r.spec
})()

function state(over: Partial<VehicleState> = {}): VehicleState {
  return {
    pos: [0, 0.2, 0],
    quat: [0, 0, 0, 1],
    vel: [0, 0, 0],
    angVel: [0, 0, 0],
    speed: 0,
    forwardSpeed: 0,
    lateralSpeed: 0,
    slipAngle: 0,
    yawRate: 0,
    upDot: 1,
    groundedWheels: 4,
    airborne: false,
    wheelspin: false,
    reversing: false,
    wheels: [],
    surface: 'tile',
    ...over,
  }
}

const IDLE: DriveInput = { steer: 0, throttle: 0, brake: 0, reverse: false }

function makeRun(id: ChallengeId) {
  const def = getChallenge(id)!
  const run = new ChallengeRun(def, -4, spec)
  run.start()
  let prev = state({ pos: [def.start.position[0], def.start.position[1] + 0.2, def.start.position[2]] })
  const step = (next: Partial<VehicleState>, input: Partial<DriveInput> = {}, events: SimEvent[] = []) => {
    const s = state({ ...next, speed: next.speed ?? Math.hypot(next.vel?.[0] ?? 0, next.vel?.[2] ?? 0), forwardSpeed: next.forwardSpeed ?? next.speed ?? 0 })
    run.update({ dt: 1 / 60, state: s, prev, input: { ...IDLE, ...input }, events, spec })
    prev = s
    return run.run
  }
  return { def, run, step, outcome: () => evaluateRun(def, run.run) }
}

describe('gate races', () => {
  it('only counts gates in order, so shortcuts cannot finish (AC18)', () => {
    const { def, step, outcome } = makeRun('kitchen_sprint')
    const y = def.gates[0]!.centre[1]
    // Teleport straight past every gate plane in one tick, then keep going.
    step({ pos: [0, y, 0] })
    step({ pos: [0, y, 50] })
    for (let i = 0; i < 5; i++) step({ pos: [0, y, 51 + i] })
    expect(outcome().status).not.toBe('finished')
    // Driving around the outside of the gates also does not count.
    const side = makeRun('kitchen_sprint')
    for (let z = 0; z < 60; z += 0.5) side.step({ pos: [30, y, z] })
    expect(side.outcome().status).not.toBe('finished')
  })

  it('finishes with an interpolated time when gates are passed in order', () => {
    const { def, step, outcome } = makeRun('kitchen_sprint')
    for (const g of def.gates) {
      step({ pos: [g.centre[0], g.centre[1], g.centre[2] - 0.3], speed: 3 })
      step({ pos: [g.centre[0], g.centre[1], g.centre[2] + 0.3], speed: 3 })
    }
    const o = outcome()
    expect(o.status).toBe('finished')
    expect(o.metrics.time).toBeGreaterThan(0)
    expect(o.completion === 'finished' || o.completion === 'great').toBe(true)
  })

  it('never invents a finish time for an unfinished attempt and keeps progress', () => {
    const { def, step, run, outcome } = makeRun('garden_mud')
    step({ pos: [0, def.gates[0]!.centre[1], def.gates[0]!.centre[2] - 0.3] })
    step({ pos: [0, def.gates[0]!.centre[1], def.gates[0]!.centre[2] + 0.3] })
    run.abandon()
    const o = outcome()
    expect(o.status).toBe('abandoned')
    expect(o.metrics.time).toBeUndefined()
    expect(o.progress).toBeGreaterThan(0.1)
    expect(o.completion).toBeNull()
  })

  it('ends a run that falls out of the world', () => {
    const { step, outcome } = makeRun('garden_climb')
    step({ pos: [14, -10, 0] })
    expect(outcome().status).toBe('ended')
    expect(outcome().endReason).toBe('out_of_bounds')
  })
})

describe('quick start', () => {
  it('needs the target speed held, so a one-tick spike does not count', () => {
    const { step, outcome } = makeRun('kitchen_acceleration')
    for (let i = 0; i < 30; i++) step({ speed: 1 })
    step({ speed: 4.5, forwardSpeed: 4.5 })
    step({ speed: 2, forwardSpeed: 2 })
    expect(outcome().status).not.toBe('finished')
    for (let i = 0; i < 20; i++) step({ speed: 4.2, forwardSpeed: 4.2 })
    const o = outcome()
    expect(o.status).toBe('finished')
    // Reported time is when the held speed was first reached, not when the hold ended.
    expect(o.metrics.accelTime).toBeLessThan(o.elapsed)
  })
})

describe('stop box', () => {
  const lane = (step: ReturnType<typeof makeRun>['step'], def: ReturnType<typeof makeRun>['def'], entrySpeed: number) => {
    const g = def.gates[0]!
    step({ pos: [g.centre[0], 0.2, g.centre[2] - 0.2], speed: entrySpeed })
    step({ pos: [g.centre[0], 0.2, g.centre[2] + 0.2], speed: entrySpeed, forwardSpeed: entrySpeed, vel: [0, 0, entrySpeed] })
  }
  const stop = (step: ReturnType<typeof makeRun>['step'], z0: number, x: number) => {
    let z = z0
    for (let v = 3; v > 0.05; v -= 0.1) {
      z += v / 60
      step({ pos: [x, 0.2, z], speed: v, forwardSpeed: v, vel: [0, 0, v] }, { brake: 1 })
    }
    for (let i = 0; i < 40; i++) step({ pos: [x, 0.2, z], speed: 0.01, vel: [0, 0, 0.01] }, { brake: 1 })
  }

  it('measures from the first brake in the lane to a stable stop when entry speed is in range', () => {
    const { def, step, outcome } = makeRun('kitchen_braking')
    const x = def.gates[0]!.centre[0]
    lane(step, def, 3.2)
    stop(step, 18, x)
    const o = outcome()
    expect(o.status).toBe('finished')
    expect(o.metrics.stoppingDistance).toBeGreaterThan(0.3)
    expect(o.eligible).toBe(true)
  })

  it('keeps the attempt but marks it not comparable when the entry speed is outside the tolerance (AC19)', () => {
    const { def, step, outcome } = makeRun('kitchen_braking')
    lane(step, def, 4.6)
    stop(step, 18, def.gates[0]!.centre[0])
    const o = outcome()
    expect(o.status).toBe('finished')
    expect(o.eligible).toBe(false)
    expect(o.invalidReasons.join()).toMatch(/Entry speed/)
  })

  it('invalidates the record after a wall hit, leaving the lane or a reset (AC19, AC20)', () => {
    const wall = makeRun('kitchen_braking')
    lane(wall.step, wall.def, 3.2)
    wall.step({ pos: [wall.def.gates[0]!.centre[0], 0.2, 18], speed: 3 }, {}, [{ type: 'wall' }])
    stop(wall.step, 18, wall.def.gates[0]!.centre[0])
    expect(wall.outcome().eligible).toBe(false)

    const wide = makeRun('kitchen_braking')
    lane(wide.step, wide.def, 3.2)
    const x0 = wide.def.gates[0]!.centre[0]
    // Brake inside the lane, then slide out of it before stopping.
    wide.step({ pos: [x0, 0.2, 18], speed: 3, forwardSpeed: 3, vel: [0, 0, 3] }, { brake: 1 })
    for (let i = 1; i <= 40; i++) wide.step({ pos: [x0 + i * 0.12, 0.2, 18 + i * 0.03], speed: 1, forwardSpeed: 1, vel: [0.5, 0, 1] }, { brake: 1 })
    expect(wide.outcome().invalidReasons.join()).toMatch(/lane/)

    const reset = makeRun('kitchen_braking')
    reset.run.noteReset()
    lane(reset.step, reset.def, 3.2)
    stop(reset.step, 18, reset.def.gates[0]!.centre[0])
    expect(reset.outcome().eligible).toBe(false)
    expect(reset.outcome().invalidReasons).toContain('Reset used')
  })
})

describe('slide corner', () => {
  const insideZone = (def: ReturnType<typeof makeRun>['def'], angle: number): V3 => {
    const rule = def.rule
    if (rule.kind !== 'drift')
      throw new Error('rule')
    const r = (rule.zone.inner + rule.zone.outer) / 2
    return [rule.zone.centre[0] + r * Math.cos(angle), 0.2, rule.zone.centre[1] + r * Math.sin(angle)]
  }
  const slide = (over: Partial<VehicleState>, seconds: number, events: SimEvent[] = []) => {
    const t = makeRun('kitchen_drift')
    for (let i = 0; i < seconds * 60; i++) {
      t.step({ pos: insideZone(t.def, 0.1 + i * 0.002), speed: 4, forwardSpeed: 3.5, slipAngle: (25 * Math.PI) / 180, ...over }, {}, events)
    }
    return t.run.run.metrics.driftScore ?? 0
  }

  it('scores a controlled slide that lasts long enough, but not a brief one', () => {
    expect(slide({}, 1.5)).toBeGreaterThan(5)
    expect(slide({}, 0.3)).toBe(0)
  })

  it('scores nothing for stationary wheelspin, spins, reversing, wall contact or leaving the slip range (AC19)', () => {
    expect(slide({ speed: 0.3, forwardSpeed: 0.3, wheelspin: true }, 2)).toBe(0)
    expect(slide({ yawRate: 6 }, 2)).toBe(0)
    expect(slide({ forwardSpeed: -2, speed: 2 }, 2)).toBe(0)
    expect(slide({}, 2, [{ type: 'wall' }])).toBe(0)
    expect(slide({ slipAngle: (3 * Math.PI) / 180 }, 2)).toBe(0)
    expect(slide({ slipAngle: (70 * Math.PI) / 180 }, 2)).toBe(0)
  })
})

describe('coast test', () => {
  it('cuts the motor at the entry gate and reads exit speed at the measurement gate', () => {
    const { def, step, run, outcome } = makeRun('kitchen_coast')
    const entry = def.gates[0]!
    const measure = def.gates[1]!
    expect(run.run.motorEnabled).toBe(true)
    step({ pos: [entry.centre[0], 0.2, entry.centre[2] - 0.2], speed: 3.9 })
    step({ pos: [entry.centre[0], 0.2, entry.centre[2] + 0.2], speed: 3.9 })
    expect(run.run.motorEnabled).toBe(false)
    step({ pos: [measure.centre[0], 0.2, measure.centre[2] - 0.2], speed: 2 })
    step({ pos: [measure.centre[0], 0.2, measure.centre[2] + 0.2], speed: 2 })
    const o = outcome()
    expect(o.status).toBe('finished')
    expect(o.metrics.exitSpeed).toBeCloseTo(2)
    expect(o.eligible).toBe(true)
  })

  it('flags braking or a wall hit as not comparable', () => {
    const { def, step, outcome } = makeRun('kitchen_coast')
    const entry = def.gates[0]!
    const measure = def.gates[1]!
    step({ pos: [entry.centre[0], 0.2, entry.centre[2] - 0.2], speed: 4 })
    step({ pos: [entry.centre[0], 0.2, entry.centre[2] + 0.2], speed: 4 })
    step({ pos: [entry.centre[0], 0.2, entry.centre[2] + 2], speed: 3 }, { brake: 0.8 })
    step({ pos: [measure.centre[0], 0.2, measure.centre[2] - 0.2], speed: 2 })
    step({ pos: [measure.centre[0], 0.2, measure.centre[2] + 0.2], speed: 2 })
    expect(outcome().eligible).toBe(false)
    expect(outcome().invalidReasons.join()).toMatch(/Braked/)
  })
})

describe('plank jump', () => {
  const fly = (landing: Partial<VehicleState>) => {
    const t = makeRun('garden_jump')
    const z = t.def.rule.kind === 'jump' ? t.def.rule.takeoff.centre[2] : 0
    const x = t.def.start.position[0]
    for (let i = 0; i < 5; i++) t.step({ pos: [x, 1, z - 1 + i * 0.1], groundedWheels: 4 })
    for (let i = 0; i < 40; i++) t.step({ pos: [x, 1.4, z + i * 0.1], groundedWheels: 0, airborne: true })
    for (let i = 0; i < 90; i++) t.step({ pos: [x, 0.2, z + 4], groundedWheels: 4, ...landing })
    return t.outcome()
  }

  it('counts the distance when the car lands upright and keeps wheel contact for a second', () => {
    const o = fly({})
    expect(o.status).toBe('finished')
    expect(o.metrics.jumpDistance).toBeGreaterThan(3)
  })

  it('does not count a landing on the roof', () => {
    const o = fly({ upDot: -0.9 })
    expect(o.status).toBe('ended')
    expect(o.metrics.jumpDistance).toBeUndefined()
  })
})

describe('reset (AC20)', () => {
  it('restores a safe pose with velocities cleared and marks the scored attempt as practice', async () => {
    const R = await loadRapier()
    const def = getChallenge('kitchen_acceleration')!
    const pw = new PhysicsWorld(R, ENVIRONMENTS.kitchen)
    const session = new DriveSession({ pw, spec, challenge: def, assist: 'light' })
    session.settle()
    session.start()
    const gas = { ...emptyControls(), throttle: true, throttleAxis: 1 }
    for (let i = 0; i < 40; i++) session.step(gas)
    expect(session.sim.state.speed).toBeGreaterThan(1)
    session.requestReset()
    session.step({ ...emptyControls() })
    const s = session.sim.state
    expect(s.speed).toBeLessThan(0.5)
    expect(Math.hypot(s.pos[0] - def.start.position[0], s.pos[2] - def.start.position[2])).toBeLessThan(0.5)
    expect(s.upDot).toBeGreaterThan(0.99)
    expect(session.run!.run.resets).toBe(1)
    for (let i = 0; i < 200; i++) session.step(gas)
    const o = evaluateRun(def, session.run!.run)
    expect(o.status).toBe('finished')
    expect(o.eligible).toBe(false)
    expect(o.invalidReasons).toContain('Reset used')
    expect(o.metrics.resets).toBe(1)
  })

  it('offers a reset prompt after three seconds upside down or stuck', () => {
    const t = makeRun('kitchen_acceleration')
    for (let i = 0; i < 60 * 2.5; i++) t.step({ upDot: -1 })
    expect(t.run.resetSuggested).toBe(false)
    for (let i = 0; i < 60; i++) t.step({ upDot: -1 })
    expect(t.run.resetSuggested).toBe(true)
  })
})
