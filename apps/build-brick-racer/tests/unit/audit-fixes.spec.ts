import type { CarDocument } from '@/game/build/types'
import type { RunRecord } from '@/game/persistence/types'
import type { VehicleState } from '@/game/vehicle/sim'
import { createMemoryStorage } from '@ld/offline'
import { describe, expect, it } from 'vitest'
import { computeAssemblies } from '@/game/build/assemblies'
import { findPlacements } from '@/game/build/candidates'
import { createEmptyDoc, defaultContext, sequentialContext } from '@/game/build/doc'
import { addParts, paintParts, rotateParts, setForward } from '@/game/build/edit'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { ENVIRONMENTS, getChallenge } from '@/game/challenges'
import { ChallengeRun } from '@/game/challenges/run'
import { settingsSignature } from '@/game/comparison'
import { seal } from '@/game/persistence/checksum'
import { GameRepo } from '@/game/persistence/repo'
import { recordRun } from '@/game/run-flow'
import { DriveSession } from '@/game/session'
import { assessDrive } from '@/game/vehicle/analysis'
import { compileVehicle } from '@/game/vehicle/compile'
import { emptyControls } from '@/game/vehicle/input'
import { PHYSICS_VERSION, SURFACE_SIGNATURE } from '@/game/vehicle/physics-config'
import { loadRapier } from '@/game/vehicle/rapier'
import { PhysicsWorld } from '@/game/vehicle/world'
import { setRepo } from '@/lib/platform/repo'
import { useEditorStore } from '@/stores/editor.store'

const memRepo = () => new GameRepo(createMemoryStorage(), { get: async () => null, set: async () => undefined })
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok)
    throw new Error(JSON.stringify(r))
  return r as Extract<T, { ok: true }>
}

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

describe('saves are reconnected on load', () => {
  it('rebuilds connections and wheel groups for a migrated v0 save so the car can drive', async () => {
    const racer = buildStarter('racer', sequentialContext('m'))
    const old = {
      schemaVersion: 0,
      id: 'v0car',
      name: 'Old racer',
      facing: 'z+',
      parts: racer.instances.map(i => ({ id: i.id, def: i.defId, x: i.pos[0], y: i.pos[1], z: i.pos[2], rot: i.rot, color: i.colour })),
    }
    const db = createMemoryStorage()
    await db.set('car:v0car', seal(old))
    const repo = new GameRepo(db, { get: async () => null, set: async () => undefined })
    const loaded = (await repo.loadCar('v0car'))!
    expect(loaded.migrated).toBe(true)
    expect(loaded.doc.connections.length).toBeGreaterThan(10)
    expect(loaded.doc.wheelGroups).toHaveLength(2)
    const a = assessDrive(loaded.doc, catalog)
    expect(a.blocks).toHaveLength(0)
    expect(a.spec!.wheels).toHaveLength(4)
    // The rebuilt car is what is stored now.
    expect((await repo.loadCar('v0car'))!.doc.connections).toEqual(loaded.doc.connections)
  })
})

describe('placeholders and edits', () => {
  const withGhost = () => {
    const c = sequentialContext('g')
    const doc = buildStarter('racer', c)
    const top = doc.instances.find(i => i.defId === 'plate_2x4')!
    const ghost = { id: 'ghost', defId: 'future_brick', defVersion: 9, pos: [2, 6, 10] as [number, number, number], rot: 0 as const, colour: 'red' }
    const connected: CarDocument = {
      ...doc,
      instances: [...doc.instances, ghost],
      connections: [...doc.connections, { id: 'ghost-link', a: { instanceId: 'ghost', connectorId: 'k0_0' }, b: { instanceId: top.id, connectorId: 's0_0_1' }, type: 'stud' }],
    }
    return { c, doc: connected, other: doc.instances.find(i => i.defId === 'brick_2x4')!.id }
  }

  it('keeps connections to missing pieces across edits, so the car stays blocked until resolved', () => {
    const { c, doc, other } = withGhost()
    expect(assessDrive(doc, catalog).blocks[0]?.code).toBe('unknown_part')
    const painted = ok(paintParts(doc, [other], 'green', c)).doc
    expect(painted.connections.some(x => x.id === 'ghost-link')).toBe(true)
    expect(assessDrive(painted, catalog).blocks[0]?.code).toBe('unknown_part')
  })

  it('refuses to turn a selection containing a missing piece instead of throwing', () => {
    const { c, doc, other } = withGhost()
    const result = rotateParts(doc, [other, 'ghost'], c)
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.issues[0]!.instanceIds).toContain('ghost')
  })
})

describe('forward direction and wheel orientation', () => {
  function axleCar() {
    const c = sequentialContext('f')
    let doc = ok(addParts(createEmptyDoc(c), [{ defId: 'chassis_long', pos: [1, 3, 0], rot: 0, colour: 'grey' }], c)).doc
    for (const z of [2, 17]) {
      doc = ok(addParts(doc, [{ defId: 'axle_beam', pos: [0, 0, z], rot: 0, colour: 'black' }], c)).doc
      const spots = findPlacements(doc, catalog.get('wheel_road')!, { rotations: [0, 1, 2, 3] }, c).filter(k => Math.abs(k.pos[2] - z) <= 3)
      doc = ok(addParts(doc, spots.map(k => ({ defId: 'wheel_road', pos: k.pos, rot: k.rot, colour: 'yellow' })), c)).doc
    }
    return { c, doc }
  }

  it('re-derives default steering to the new front axle when the forward direction changes', () => {
    const { c, doc } = axleCar()
    const frontZ = (d: CarDocument): number[] => {
      const compiled = compileVehicle(d, catalog)
      return compiled.ok ? compiled.spec.wheels.filter(w => w.steering).map(w => w.pos[2]) : []
    }
    expect(frontZ(doc).every(z => z > 0)).toBe(true)
    const flipped = ok(setForward(doc, 'z-', c)).doc
    expect(frontZ(flipped).length).toBeGreaterThan(0)
    expect(frontZ(flipped).every(z => z > 0)).toBe(true)
  })

  it('warns when the wheels point along the forward axis', () => {
    const c = sequentialContext('s')
    const sideways = ok(setForward(buildStarter('racer', c), 'x+', c)).doc
    const a = assessDrive(sideways, catalog)
    expect(a.blocks).toHaveLength(0)
    expect(a.warnings.some(w => w.code === 'odd_wheels' && /sideways/.test(w.message))).toBe(true)
  })

  it('drives the wheeled assembly when the first-placed piece is a tiny loose root', () => {
    const c = sequentialContext('r')
    const doc = buildStarter('racer', c)
    const rooted = ok(addParts(doc, [{ defId: 'brick_1x1', pos: [40, 0, 40], rot: 0, colour: 'red' }], c)).doc
    const root = rooted.instances.find(i => i.pos[0] === 40)!.id
    const withLooseRoot = { ...rooted, rootInstanceId: root }
    const assemblies = computeAssemblies(withLooseRoot, catalog)
    expect(assemblies.components[assemblies.mainIndex]!.length).toBeGreaterThan(10)
    const a = assessDrive(withLooseRoot, catalog)
    expect(a.blocks).toHaveLength(0)
    expect(a.spec!.wheels).toHaveLength(4)
  })
})

describe('personal best and comparison eligibility', () => {
  const signature = settingsSignature({ challengeId: 'kitchen_coast', challengeVersion: 1, physicsVersion: PHYSICS_VERSION, surfaceSignature: SURFACE_SIGNATURE, powerMode: 'motor', assist: 'light' })
  let n = 0
  const run = (over: Partial<RunRecord>): RunRecord => {
    n += 1
    return {
      id: `r${n}`,
      carId: 'c',
      carName: 'C',
      carSnapshotId: 's',
      challengeId: 'kitchen_coast',
      challengeVersion: 1,
      physicsVersion: PHYSICS_VERSION,
      surfaceSignature: SURFACE_SIGNATURE,
      powerMode: 'motor',
      assist: 'light',
      environmentVersion: 1,
      controls: { leftHanded: false, scale: 1 },
      camera: 'chase',
      signature,
      startedAt: '2026-01-01T00:00:00Z',
      endedAt: `2026-01-01T00:00:${String(10 + n)}Z`,
      status: 'finished',
      endReason: 'finished',
      metrics: { exitSpeed: 2 },
      eligible: true,
      invalidReasons: [],
      completion: 'finished',
      wasBest: false,
      progress: 1,
      resets: 0,
      message: null,
      replayRef: null,
      ...over,
    }
  }
  const out = (r: RunRecord) => ({ status: r.status, eligible: r.eligible, completion: r.completion, metrics: r.metrics, progress: r.progress })

  it('compares against the previous ELIGIBLE run and never gives a practice run the Great award', async () => {
    const repo = memRepo()
    const def = getChallenge('kitchen_coast')!
    const a = run({})
    const b = run({ eligible: false, invalidReasons: ['Braked during the test'], completion: 'great', metrics: { exitSpeed: 3 } })
    const c = run({})
    for (const r of [a, b])
      await repo.commitRun(r, def, out(r), null)
    expect((await repo.getProgress(signature))!.great).toBe(false)
    await repo.commitRun(c, def, out(c), null)
    expect((await repo.previousComparable(c))!.id).toBe(a.id)
  })
})

describe('recording the same attempt twice', () => {
  it('uses one run id per attempt so a retried save does not duplicate the record', async () => {
    const repo = memRepo()
    const doc = buildStarter('racer', sequentialContext('d'))
    const def = getChallenge('kitchen_acceleration')!
    const compiled = compileVehicle(doc, catalog)
    if (!compiled.ok)
      throw new Error('compile')
    const R = await loadRapier()
    const session = new DriveSession({ pw: new PhysicsWorld(R, ENVIRONMENTS.kitchen), spec: compiled.spec, challenge: def, assist: 'light' })
    session.settle()
    session.start()
    for (let i = 0; i < 300 && session.run!.run.phase === 'running'; i++) session.step({ ...emptyControls(), throttle: true, throttleAxis: 1 })
    const args = { repo, doc, def, session, run: session.run!, assist: 'light' as const, camera: 'chase' as const, controls: { leftHanded: false, scale: 1 }, startedAt: new Date().toISOString(), replayBudgetBytes: 1e8 }
    const first = await recordRun(args)
    const second = await recordRun(args)
    expect(second.run.id).toBe(first.run.id)
    expect(await repo.listRuns()).toHaveLength(1)
    expect((await repo.getProgress(first.run.signature))!.attempts).toBe(1)
  }, 30000)

  it('gives free drive the same reset prompt after three seconds upside down', async () => {
    const doc = buildStarter('racer', sequentialContext('d'))
    const compiled = compileVehicle(doc, catalog)
    if (!compiled.ok)
      throw new Error('compile')
    const R = await loadRapier()
    const session = new DriveSession({ pw: new PhysicsWorld(R, ENVIRONMENTS.kitchen), spec: compiled.spec, challenge: null, assist: 'light' })
    session.settle()
    expect(session.resetSuggested).toBe(false)
    // Flip the car onto its roof and let it sit.
    session.sim.rigidBody.setRotation({ x: 0, y: 0, z: 1, w: 0 }, true)
    for (let i = 0; i < 60 * 4; i++) session.step(emptyControls())
    expect(session.sim.state.upDot).toBeLessThan(0.25)
    expect(session.resetSuggested).toBe(true)
    session.requestReset()
    session.step(emptyControls())
    expect(session.resetSuggested).toBe(false)
  }, 30000)
})

describe('rule fixes', () => {
  it('a brief loss of ground contact in the take-off zone is not a jump, and a one-wheel landing still counts', () => {
    const def = getChallenge('garden_jump')!
    const z = def.rule.kind === 'jump' ? def.rule.takeoff.centre[2] : 0
    const x = def.start.position[0]
    const make = () => {
      const r = new ChallengeRun(def, -4)
      r.start()
      let prev = state({ pos: [x, 1, z] })
      const step = (s: Partial<VehicleState>) => {
        const next = state({ pos: [x, 1, z], ...s })
        r.update({ dt: 1 / 60, state: next, prev, input: { steer: 0, throttle: 0, brake: 0, reverse: false }, events: [], spec: undefined as never })
        prev = next
      }
      return { r, step }
    }
    const hop = make()
    for (let i = 0; i < 5; i++) hop.step({})
    hop.step({ groundedWheels: 0, airborne: true })
    for (let i = 0; i < 120; i++) hop.step({})
    expect(hop.r.run.phase).toBe('running')
    expect(hop.r.run.metrics.jumpDistance).toBeUndefined()

    const one = make()
    for (let i = 0; i < 5; i++) one.step({})
    for (let i = 0; i < 40; i++) one.step({ groundedWheels: 0, airborne: true, pos: [x, 1.4, z + i * 0.1] })
    for (let i = 0; i < 90; i++) one.step({ groundedWheels: 1, pos: [x, 0.2, z + 4] })
    expect(one.r.run.phase).toBe('finished')
  })

  it('uses the half-second stable stop from the spec', () => {
    const rule = getChallenge('kitchen_braking')!.rule
    expect(rule.kind === 'brake_test' && rule.stopHold).toBe(0.5)
  })
})

describe('editor store', () => {
  it('recreates the mirror plane after an undo and does not spend undo steps on empty selections', async () => {
    setRepo(memRepo())
    const store = useEditorStore
    const c = defaultContext
    const doc = buildStarter('racer', c)
    store.getState().load(doc)
    store.getState().toggleMirror()
    expect(store.getState().doc!.ui.mirrorPlane2).not.toBeNull()
    // Empty selection: nothing happens and no history entry is added.
    const before = store.getState().history.past.length
    expect(store.getState().paintSelection('red')).toBe(false)
    expect(store.getState().moveSelection([0, 0, 1])).toBe(false)
    expect(store.getState().history.past.length).toBe(before)
    // Simulate the plane being lost with mirroring still on, then place a symmetric piece.
    store.setState({ doc: { ...store.getState().doc!, ui: { ...store.getState().doc!.ui, mirrorPlane2: null } } })
    const spot = findPlacements(store.getState().doc!, catalog.get('brick_1x1')!, { rotations: [0] }, c).find(k => k.pos[1] >= 5)!
    store.getState().place(spot)
    expect(store.getState().doc!.ui.mirrorPlane2).not.toBeNull()
    await store.getState().unload()
    setRepo(null)
  })
})
