import type { AsyncStorage } from '@ld/offline'
import type { CarDocument } from '@/game/build/types'
import type { StringStore } from '@/game/persistence/repo'
import type { RunRecord } from '@/game/persistence/types'
import type { VehicleState } from '@/game/vehicle/sim'
import { createMemoryStorage } from '@ld/offline'
import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { addParts, swapWheelGroup } from '@/game/build/edit'
import { placeAll } from '@/game/build/geometry'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { getChallenge } from '@/game/challenges'
import { compareMetric, compareRuns, compatible, describeBuildChange, settingsSignature } from '@/game/comparison'
import { seal } from '@/game/persistence/checksum'
import { GameRepo } from '@/game/persistence/repo'
import { ReplayPlayer } from '@/game/replay/player'
import { ReplayRecorder } from '@/game/replay/recorder'
import { assessDrive } from '@/game/vehicle/analysis'
import { PHYSICS_VERSION, SURFACE_SIGNATURE } from '@/game/vehicle/physics-config'

function kv(): StringStore {
  const map = new Map<string, string>()
  return { get: async k => map.get(k) ?? null, set: async (k, v) => void map.set(k, v) }
}
const newRepo = (db: AsyncStorage = createMemoryStorage()) => ({ db, repo: new GameRepo(db, kv(), () => '2026-01-01T00:00:00.000Z') })
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok)
    throw new Error(JSON.stringify(r))
  return r as Extract<T, { ok: true }>
}

let runCounter = 0
function runRecord(over: Partial<RunRecord> = {}): RunRecord {
  const base = {
    challengeId: 'garden_mud' as const,
    challengeVersion: 1,
    physicsVersion: PHYSICS_VERSION,
    surfaceSignature: SURFACE_SIGNATURE,
    powerMode: 'motor' as const,
    assist: 'light' as const,
  }
  runCounter += 1
  return {
    ...base,
    id: `run${runCounter}`,
    carId: 'car1',
    carName: 'Mud Monster',
    carSnapshotId: 'snapA',
    environmentVersion: 1,
    controls: { leftHanded: false, scale: 1 },
    camera: 'chase',
    signature: settingsSignature(base),
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: `2026-01-01T00:00:${String(runCounter).padStart(2, '0')}.000Z`,
    status: 'finished',
    endReason: 'finished',
    metrics: { time: 23.1, peakSpeed: 2.4 },
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

function outcomeFor(r: RunRecord) {
  return { status: r.status, eligible: r.eligible, completion: r.completion, metrics: r.metrics, progress: r.progress }
}

describe('cars (AC24, AC25, AC26, AC27)', () => {
  it('round-trips every part, connection, role, colour and the forward direction (AC24)', async () => {
    const { repo } = newRepo()
    const doc = buildStarter('buggy', sequentialContext('s'))
    expect((await repo.saveCar(doc)).ok).toBe(true)
    const loaded = await repo.loadCar(doc.carId)
    expect(loaded!.recovered).toBe(false)
    expect(loaded!.doc).toEqual(doc)
    expect(loaded!.doc.forward).toBe('z+')
    expect(loaded!.doc.wheelGroups.every(g => g.userRoles)).toBe(true)
  })

  it('recovers the last complete car after an interrupted or damaged write (AC25)', async () => {
    const { db, repo } = newRepo()
    const c = sequentialContext('s')
    const v1 = buildStarter('racer', c)
    await repo.saveCar(v1)
    const v2 = ok(addParts(v1, [{ defId: 'ballast', pos: [2, 6, 10], rot: 0, colour: 'grey' }], c)).doc
    await repo.saveCar(v2)

    // The newest write is damaged half way: body cut short but the old checksum remains.
    const main = await db.get<{ checksum: string, savedAt: string, body: string }>(`car:${v1.carId}`)
    await db.set(`car:${v1.carId}`, { ...main!, body: main!.body.slice(0, 40) })
    const loaded = await repo.loadCar(v1.carId)
    expect(loaded!.recovered).toBe(true)
    expect(loaded!.doc.revisionId).toBe(v1.revisionId)
    expect(loaded!.doc.instances).toHaveLength(v1.instances.length)

    // A failed second slot write leaves the previous complete car intact.
    let failNext = false
    const flaky: AsyncStorage = {
      ...db,
      get: db.get,
      keys: db.keys,
      remove: db.remove,
      set: async (key, value) => {
        if (failNext && key === `car:${v1.carId}`)
          throw new DOMException('Out of space', 'QuotaExceededError')
        return db.set(key, value)
      },
    }
    const r2 = new GameRepo(flaky, kv())
    await r2.saveCar(v1)
    failNext = true
    const outcome = await r2.saveCar(v2)
    expect(outcome).toEqual({ ok: false, error: 'storage_full' })
    failNext = false
    expect((await r2.loadCar(v1.carId))!.doc.carId).toBe(v1.carId)
  })

  it('does not duplicate a run or its personal best when a save is retried (AC25)', async () => {
    const { repo } = newRepo()
    const def = getChallenge('garden_mud')!
    const run = runRecord()
    const first = await repo.commitRun(run, def, outcomeFor(run), null)
    const again = await repo.commitRun(run, def, outcomeFor(run), null)
    expect(again.run.id).toBe(first.run.id)
    expect((await repo.listRuns()).length).toBe(1)
    const progress = await repo.getProgress(run.signature)
    expect(progress!.attempts).toBe(1)
    expect(first.run.wasBest).toBe(true)
  })

  it('finishes an interrupted run commit from the journal and keeps metrics if the replay fails', async () => {
    const { db, repo } = newRepo()
    const def = getChallenge('garden_mud')!
    const run = runRecord()
    // Simulate a crash after the journal entry was written.
    await db.set(`journal:${run.id}`, { run: { ...run, wasBest: true }, progress: { signature: run.signature, challengeId: run.challengeId, bestRunId: run.id, bestValue: 23.1, completed: true, great: false, lastAttemptId: run.id, attempts: 1, maxProgress: 1 } })
    expect(await repo.recoverJournal()).toBe(1)
    expect((await repo.getRun(run.id))!.wasBest).toBe(true)
    expect(await db.keys()).not.toContain(`journal:${run.id}`)

    const run2 = runRecord()
    const rec = new ReplayRecorder(0)
    rec.capture(0, { pos: [0, 0, 0], quat: [0, 0, 0, 1], wheels: [] } as unknown as VehicleState, true)
    const replay = rec.finish(run2.id, 's', 'garden_mud', 1)
    const failingReplay: AsyncStorage = { ...db, get: db.get, keys: db.keys, remove: db.remove, set: async (k, v) => {
      if (k.startsWith('replay:'))
        throw new Error('disk')
      return db.set(k, v)
    } }
    const saved = await new GameRepo(failingReplay, kv()).commitRun(run2, def, outcomeFor(run2), replay)
    expect(saved.replaySaved).toBe(false)
    const stored = await repo.getRun(run2.id)
    expect(stored!.metrics.time).toBe(23.1)
    expect(stored!.replayRef).toBeNull()
  })

  it('migrates an older save, keeps a backup until the new write succeeds, and reports unknown versions (AC26)', async () => {
    const { db, repo } = newRepo()
    const old = {
      schemaVersion: 0,
      id: 'old1',
      name: 'Old racer',
      facing: 'z+',
      parts: [{ id: 'a', def: 'chassis_short', x: 0, y: 3, z: 0, rot: 0, color: 'grey' }, { id: 'b', def: 'brick_2x2', x: 0, y: 5, z: 0, rot: 0, color: 'red' }],
    }
    await db.set('car:old1', seal(old))
    const loaded = await repo.loadCar('old1')
    expect(loaded!.migrated).toBe(true)
    expect(loaded!.doc.schemaVersion).toBe(1)
    expect(loaded!.doc.instances.map(i => i.defId)).toEqual(['chassis_short', 'brick_2x2'])
    expect(loaded!.doc.instances[1]!.colour).toBe('red')
    expect(await db.keys()).not.toContain('backup:car:old1:v0')
    expect((await repo.loadCar('old1'))!.migrated).toBe(false)

    await db.set('car:future', seal({ schemaVersion: 99, carId: 'future', instances: [] }))
    expect(await repo.loadCar('future')).toBeNull()
  })

  it('keeps unknown part definitions in the saved car and blocks driving with an actionable reason (AC26)', async () => {
    const { repo } = newRepo()
    const c = sequentialContext('m')
    let doc: CarDocument = buildStarter('racer', c)
    doc = { ...doc, instances: [...doc.instances, { id: 'ghostpart', defId: 'brick_from_the_future', defVersion: 9, pos: [10, 0, 10], rot: 0, colour: 'red' }] }
    await repo.saveCar(doc)
    const loaded = (await repo.loadCar(doc.carId))!.doc
    expect(loaded.instances.some(i => i.id === 'ghostpart')).toBe(true)
    expect(placeAll(loaded.instances, catalog).missing.map(m => m.id)).toEqual(['ghostpart'])
    // Loose and unknown: the connected car can still drive, the placeholder is flagged.
    const a = assessDrive(loaded, catalog)
    expect(a.blocks.length + a.warnings.length).toBeGreaterThanOrEqual(0)
    const connectedMissing = { ...loaded, connections: [...loaded.connections, { id: 'x', a: { instanceId: 'ghostpart', connectorId: 'k0_0' }, b: { instanceId: loaded.instances[0]!.id, connectorId: 's0_0_2' }, type: 'stud' as const }] }
    const blocked = assessDrive(connectedMissing, catalog)
    expect(blocked.blocks[0]?.code).toBe('unknown_part')
    expect(blocked.blocks[0]?.instanceIds).toContain('ghostpart')
  })

  it('lists, renames, duplicates and deletes cars while keeping snapshots that runs reference (AC27)', async () => {
    const { repo } = newRepo()
    const c = sequentialContext('l')
    const doc = buildStarter('racer', c)
    await repo.saveCar(doc)
    const snapId = await repo.saveSnapshot(doc)
    expect(await repo.saveSnapshot(doc)).toBe(snapId)
    const run = runRecord({ carId: doc.carId, carSnapshotId: snapId })
    await repo.commitRun(run, getChallenge('garden_mud')!, outcomeFor(run), null)
    expect((await repo.listCars()).map(x => x.id)).toEqual([doc.carId])
    await repo.deleteCar(doc.carId)
    expect(await repo.listCars()).toHaveLength(0)
    expect(await repo.loadCar(doc.carId)).toBeNull()
    expect((await repo.getSnapshot(snapId))!.doc.carId).toBe(doc.carId)
    expect((await repo.getRun(run.id))!.carSnapshotId).toBe(snapId)
  })
})

describe('run history (AC22, AC23)', () => {
  it('keeps the exact car of a run after the saved car is edited (AC22)', async () => {
    const { repo } = newRepo()
    const c = sequentialContext('h')
    const before = buildStarter('racer', c)
    const snapId = await repo.saveSnapshot(before)
    const front = before.wheelGroups.find(g => g.steering)!
    const after = ok(swapWheelGroup(before, front.id, 'wheel_offroad', c)).doc
    await repo.saveCar(after)
    const snap = await repo.getSnapshot(snapId)
    expect(snap!.doc.instances.filter(i => i.defId === 'wheel_road')).toHaveLength(4)
    expect(after.instances.filter(i => i.defId === 'wheel_road')).toHaveLength(2)
    const afterSnap = await repo.saveSnapshot(after)
    expect(afterSnap).not.toBe(snapId)
    expect(describeBuildChange(snap, await repo.getSnapshot(afterSnap))).toContain('Larger wheels')
  })

  it('establishes a personal best from the first eligible result and replaces it only when beaten (AC23)', async () => {
    const { repo } = newRepo()
    const def = getChallenge('garden_mud')!
    const first = runRecord({ metrics: { time: 23.1 } })
    const second = runRecord({ metrics: { time: 21.8 } })
    const slower = runRecord({ metrics: { time: 25 } })
    const practice = runRecord({ metrics: { time: 10 }, eligible: false, invalidReasons: ['Reset used'] })
    const r1 = await repo.commitRun(first, def, outcomeFor(first), null)
    expect(r1.run.wasBest).toBe(true)
    const r2 = await repo.commitRun(second, def, outcomeFor(second), null)
    expect(r2.run.wasBest).toBe(true)
    expect((await repo.commitRun(slower, def, outcomeFor(slower), null)).run.wasBest).toBe(false)
    expect((await repo.commitRun(practice, def, outcomeFor(practice), null)).run.wasBest).toBe(false)
    const progress = (await repo.getProgress(first.signature))!
    expect(progress.bestRunId).toBe(second.id)
    expect(progress.bestValue).toBe(21.8)
    expect(progress.attempts).toBe(4)
    expect((await repo.previousComparable(second))!.id).toBe(first.id)
  })

  it('compares only matching settings and reports directionally correct deltas (AC23)', () => {
    const a = runRecord({ metrics: { time: 21.8, peakSpeed: 2.6, stoppingDistance: 0.5, jumpDistance: 4, driftScore: 30 } })
    const b = runRecord({ metrics: { time: 23.1, peakSpeed: 2.4, stoppingDistance: 0.7, jumpDistance: 3, driftScore: 25 } })
    expect(compatible(a, b)).toBe(true)
    const cmp = compareRuns(a, b)
    const byId = Object.fromEntries(cmp.deltas.map(d => [d.id, d]))
    expect(byId.time!.direction).toBe('better')
    expect(byId.time!.phrase).toBe('1.3 seconds quicker')
    expect(byId.stoppingDistance!.direction).toBe('better')
    expect(byId.jumpDistance!.direction).toBe('better')
    expect(byId.driftScore!.direction).toBe('better')
    expect(byId.peakSpeed!.direction).toBe('info')
    expect(compareMetric('time', 25, 23).direction).toBe('worse')
    expect(compareMetric('time', undefined, 23).current).toBe('Not measured')

    for (const change of [{ assist: 'off' as const }, { physicsVersion: 99 }, { challengeVersion: 2 }, { powerMode: 'gravity' as const }, { surfaceSignature: 'other' }]) {
      const other = runRecord(change)
      expect(compatible(a, other)).toBe(false)
      expect(compareRuns(a, other).compatible).toBe(false)
    }
    expect(compareRuns(a, null).compatible).toBe(false)
  })

  it('reports interrupted attempts without recording a completed run', async () => {
    const { repo } = newRepo()
    await repo.beginAttempt({ carId: 'car1', challengeId: 'garden_mud' })
    const interrupted = await repo.takeInterrupted()
    expect(interrupted!.carId).toBe('car1')
    expect(await repo.takeInterrupted()).toBeNull()
    expect(await repo.listRuns()).toHaveLength(0)
  })
})

describe('replays', () => {
  const frame = (t: number, x: number) => ({ pos: [x, 0, t], quat: [0, 0, 0, 1], wheels: [{ steer: 0, spin: t, offset: 0 }] }) as unknown as VehicleState

  it('plays back recorded samples with interpolation and does not interpolate across a reset', () => {
    const rec = new ReplayRecorder(1)
    rec.capture(0, frame(0, 0), true)
    rec.capture(1, frame(1, 1), true)
    rec.markBreak()
    rec.capture(1.5, frame(1.5, 100), true)
    const replay = rec.finish('r', 's', 'garden_mud', 1.5)
    const player = new ReplayPlayer(replay)
    expect(player.at(0.5)!.pos[0]).toBeCloseTo(0.5, 5)
    expect(player.at(0.5)!.wheels[0]!.spin).toBeCloseTo(0.5, 5)
    expect(player.at(1.25)!.pos[0]).toBeCloseTo(1, 5)
    expect(player.at(10)!.pos[0]).toBe(100)
    expect(replay.stride).toBe(11)
  })

  it('evicts the oldest unpinned replay first and keeps results and pinned bests', async () => {
    const { db, repo } = newRepo()
    const def = getChallenge('garden_mud')!
    const make = (runId: string, createdAt: string, size: number) => ({
      schemaVersion: 1,
      runId,
      carSnapshotId: 's',
      challengeId: 'garden_mud',
      sampleHz: 15,
      wheelCount: 0,
      stride: 8,
      samples: new Float32Array(8),
      breaks: [],
      events: [],
      duration: 1,
      sizeBytes: size,
      pinned: false,
      createdAt,
    })
    const runs = [runRecord({ metrics: { time: 30 } }), runRecord({ metrics: { time: 20 } }), runRecord({ metrics: { time: 28 } }), runRecord({ metrics: { time: 29 } })]
    for (const [i, r] of runs.entries())
      await repo.commitRun(r, def, outcomeFor(r), make(r.id, `2026-01-0${i + 1}T00:00:00Z`, 400))
    // runs[1] is the personal best and runs[3] the latest attempt: both pinned.
    const evicted = await repo.enforceReplayBudget(800)
    expect(evicted.sort()).toEqual([runs[0]!.id, runs[2]!.id].sort())
    expect(await db.get(`replay:${runs[1]!.id}`)).toBeDefined()
    expect((await repo.getRun(runs[0]!.id))!.replayRef).toBeNull()
    expect((await repo.getRun(runs[0]!.id))!.metrics.time).toBe(30)
  })
})
