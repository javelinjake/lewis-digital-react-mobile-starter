import { createMemoryStorage } from '@ld/offline'
import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { ENVIRONMENTS, getChallenge } from '@/game/challenges'
import { compareRuns } from '@/game/comparison'
import { GameRepo } from '@/game/persistence/repo'
import { ReplayPlayer } from '@/game/replay/player'
import { recordRun } from '@/game/run-flow'
import { DriveSession } from '@/game/session'
import { compileVehicle } from '@/game/vehicle/compile'
import { emptyControls } from '@/game/vehicle/input'
import { loadRapier } from '@/game/vehicle/rapier'
import { PhysicsWorld } from '@/game/vehicle/world'

const repo = () => new GameRepo(createMemoryStorage(), { get: async () => null, set: async () => undefined })

async function drive(throttle: number) {
  const doc = buildStarter('racer', sequentialContext('f'))
  const def = getChallenge('kitchen_acceleration')!
  const compiled = compileVehicle(doc, catalog)
  if (!compiled.ok)
    throw new Error('compile')
  const R = await loadRapier()
  const session = new DriveSession({ pw: new PhysicsWorld(R, ENVIRONMENTS.kitchen), spec: compiled.spec, challenge: def, assist: 'light' })
  session.settle()
  session.start()
  for (let i = 0; i < 60 * 8 && session.run!.run.phase === 'running'; i++)
    session.step({ ...emptyControls(), throttle: throttle > 0, throttleAxis: throttle })
  return { doc, def, session }
}

describe('recording a run from the garage flow', () => {
  it('saves the car snapshot, run, personal best and a replay that matches the run, even after the car is edited', async () => {
    const r = repo()
    const a = await drive(1)
    const first = await recordRun({ repo: r, doc: a.doc, def: a.def, session: a.session, run: a.session.run!, assist: 'light', camera: 'chase', controls: { leftHanded: false, scale: 1 }, startedAt: new Date().toISOString(), replayBudgetBytes: 1e8 })
    expect(first.run.status).toBe('finished')
    expect(first.run.wasBest).toBe(true)
    expect(first.run.replayRef).not.toBeNull()
    expect(first.previous).toBeNull()

    const replay = (await r.getReplay(first.run.id))!
    const player = new ReplayPlayer(replay)
    expect(player.duration).toBeCloseTo(first.run.metrics.accelTime! + 0.25, 0)
    expect(player.frames).toBeGreaterThan(10)
    const end = player.at(player.duration)!
    expect(end.pos[2]).toBeGreaterThan(2)

    // A slower attempt: not a new best, comparable to the first, with the same settings signature.
    const b = await drive(0.55)
    const slower = await recordRun({ repo: r, doc: b.doc, def: b.def, session: b.session, run: b.session.run!, assist: 'light', camera: 'chase', controls: { leftHanded: false, scale: 1 }, startedAt: new Date().toISOString(), replayBudgetBytes: 1e8 })
    if (slower.run.status === 'finished') {
      expect(slower.run.wasBest).toBe(false)
      expect(slower.previous!.id).toBe(first.run.id)
      expect(compareRuns(slower.run, slower.previous).compatible).toBe(true)
    }
    expect(slower.run.signature).toBe(first.run.signature)
    expect((await r.getProgress(first.run.signature))!.bestRunId).toBe(first.run.id)
  }, 60000)

  it('records an unfinished attempt honestly, without a time', async () => {
    const r = repo()
    const a = await drive(0)
    a.session.run!.abandon()
    const saved = await recordRun({ repo: r, doc: a.doc, def: a.def, session: a.session, run: a.session.run!, assist: 'light', camera: 'chase', controls: { leftHanded: false, scale: 1 }, startedAt: new Date().toISOString(), replayBudgetBytes: 1e8 })
    expect(saved.run.status).not.toBe('finished')
    expect(saved.run.metrics.accelTime).toBeUndefined()
    expect(saved.progress.completed).toBe(false)
    expect(saved.progress.bestRunId).toBeNull()
  }, 60000)
})
