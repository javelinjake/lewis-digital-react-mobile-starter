import { describe, expect, it } from 'vitest'
import { gameConfig } from '@/config/game.config'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { addParts } from '@/game/build/edit'
import { emptyHistory, pushHistory, redo, undo, UNDO_LIMIT } from '@/game/build/history'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { ENVIRONMENTS, getChallenge } from '@/game/challenges'
import { DriveSession } from '@/game/session'
import { compileVehicle } from '@/game/vehicle/compile'
import { emptyControls, InputRamp } from '@/game/vehicle/input'
import { loadRapier } from '@/game/vehicle/rapier'
import { rollingCoefficient } from '@/game/vehicle/tyres'
import { PhysicsWorld } from '@/game/vehicle/world'

describe('configuration', () => {
  it('ships the minimal initial configuration with later-phase features off', () => {
    expect(gameConfig.features.easyBuild && gameConfig.features.freeBuild && gameConfig.features.replay).toBe(true)
    expect(gameConfig.features.photoReference || gameConfig.features.trackBuilder || gameConfig.features.onlineSharing || gameConfig.features.assistedScanning).toBe(false)
    expect(gameConfig.partsHaveInventoryLimits).toBe(false)
    expect(gameConfig.challengeUnlockingRequired).toBe(false)
  })
})

describe('undo history (spec: at least 100 transactions)', () => {
  it('keeps at least 100 steps and each undo and redo is one step', () => {
    expect(UNDO_LIMIT).toBeGreaterThanOrEqual(gameConfig.editorUndoTarget)
    const c = sequentialContext('h')
    let doc = createEmptyDoc(c)
    let history = emptyHistory()
    for (let i = 0; i < 150; i++) {
      const next = addParts(doc, [{ defId: 'plate_1x2', pos: [i * 2, 0, 0], rot: 0, colour: 'red' }], c)
      if (!next.ok)
        throw new Error('edit')
      history = pushHistory(history, doc, 'Place')
      doc = next.doc
    }
    expect(doc.instances).toHaveLength(150)
    let undone = 0
    while (undone < 100) {
      const step = undo(history, doc)!
      history = step.history
      doc = step.doc
      undone += 1
    }
    expect(doc.instances).toHaveLength(50)
    const again = redo(history, doc)!
    expect(again.doc.instances).toHaveLength(51)
  })
})

describe('input ramp (digital buttons ramp smoothly)', () => {
  it('eases steering and throttle in and out instead of jumping', () => {
    const ramp = new InputRamp()
    const dt = 1 / 60
    const left = { ...emptyControls(), left: true, throttle: true }
    const first = ramp.sample(left, dt)
    expect(first.steer).toBeLessThan(0)
    expect(first.steer).toBeGreaterThan(-0.2)
    expect(first.throttle).toBeLessThan(0.2)
    let last = first
    for (let i = 0; i < 90; i++) last = ramp.sample(left, dt)
    expect(last.steer).toBe(-1)
    expect(last.throttle).toBe(1)
    const release = ramp.sample(emptyControls(), dt)
    expect(release.steer).toBeGreaterThan(-1)
    expect(release.steer).toBeLessThan(-0.8)
    ramp.reset()
    expect(ramp.sample(emptyControls(), dt)).toEqual({ steer: 0, throttle: 0, brake: 0, reverse: false })
  })
})

describe('rubbing wheels', () => {
  it('is flagged by the same sweep test as the editor warning and adds bounded resistance', () => {
    const c = sequentialContext('r')
    // Bare chassis with four mounted wheels, then a wide plate overhanging the rear-left wheel.
    let doc = createEmptyDoc(c)
    const parts = [
      { defId: 'chassis_short', pos: [0, 3, 0] as [number, number, number], rot: 0 as const, colour: 'grey' },
      ...[[0, 1], [4, 1], [0, 10], [4, 10]].map(([x, z]) => ({ defId: 'wheel_mount', pos: [x!, 0, z!] as [number, number, number], rot: 0 as const, colour: 'black' })),
    ]
    const base = addParts(doc, parts, c)
    if (!base.ok)
      throw new Error('base')
    doc = base.doc
    for (const m of doc.instances.filter(i => i.defId === 'wheel_mount')) {
      const left = m.pos[0] === 0
      const ax = left ? -2 : 6
      const r = addParts(doc, [{ defId: 'wheel_road', pos: [ax, -3, m.pos[2] - 1], rot: left ? 2 : 0, colour: 'yellow' }], c)
      if (!r.ok)
        throw new Error(JSON.stringify(r.issues))
      doc = r.doc
    }
    const clean = compileVehicle(doc, catalog)
    expect(clean.ok && clean.spec.wheels.some(w => w.rubbing)).toBe(false)

    const rubbed = addParts(doc, [{ defId: 'plate_4x6', pos: [-1, 5, 0], rot: 0, colour: 'red' }], c)
    expect(rubbed.ok).toBe(true)
    if (!rubbed.ok)
      return
    expect(rubbed.warnings.some(w => w.code === 'wheel_touches_body')).toBe(true)
    const compiled = compileVehicle(rubbed.doc, catalog)
    expect(compiled.ok).toBe(true)
    if (!compiled.ok)
      return
    const rubbing = compiled.spec.wheels.filter(w => w.rubbing)
    expect(rubbing.length).toBeGreaterThan(0)
    const w = rubbing[0]!
    const baseCoeff = rollingCoefficient({ ...w, rubbing: false }, 'tile')
    const rub = rollingCoefficient(w, 'tile')
    expect(rub).toBeGreaterThan(baseCoeff)
    expect(rub / baseCoeff).toBeLessThanOrEqual(2)
  })
})

describe('determinism', () => {
  it('the same player inputs give the same run, independent of how often the screen draws', async () => {
    const run = async () => {
      const doc = buildStarter('racer', sequentialContext('d'))
      const compiled = compileVehicle(doc, catalog)
      if (!compiled.ok)
        throw new Error('compile')
      const R = await loadRapier()
      const def = getChallenge('kitchen_sprint')!
      const session = new DriveSession({ pw: new PhysicsWorld(R, ENVIRONMENTS.kitchen), spec: compiled.spec, challenge: def, assist: 'light' })
      session.settle()
      session.start()
      for (let i = 0; i < 60 * 6; i++)
        session.step({ ...emptyControls(), steerAxis: i > 200 ? 0.3 : 0 })
      return session.sim.state
    }
    const a = await run()
    const b = await run()
    expect(b.pos).toEqual(a.pos)
    expect(b.quat).toEqual(a.quat)
    expect(b.vel).toEqual(a.vel)
  })
})
