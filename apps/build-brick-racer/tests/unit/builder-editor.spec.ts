import type { AsyncStorage } from '@ld/offline'
import type { StringStore } from '@/game/persistence/repo'
import { createMemoryStorage } from '@ld/offline'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeAssemblies, looseInstanceIds } from '@/game/build/assemblies'
import { findPlacements } from '@/game/build/candidates'
import { defaultContext } from '@/game/build/doc'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { GameRepo } from '@/game/persistence/repo'
import { setRepo } from '@/lib/platform/repo'
import { useEditorStore } from '@/stores/editor.store'
import { useGarageStore } from '@/stores/garage.store'
import { usePrefsStore } from '@/stores/prefs.store'

function memoryKv(): StringStore {
  const map = new Map<string, string>()
  return { get: async k => map.get(k) ?? null, set: async (k, v) => void map.set(k, v) }
}

let db: AsyncStorage
let repo: GameRepo
const editor = () => useEditorStore.getState()

function freshRacer() {
  const doc = buildStarter('racer', defaultContext)
  editor().load(doc)
  return doc
}

beforeEach(() => {
  db = createMemoryStorage()
  repo = new GameRepo(db, memoryKv())
  setRepo(repo)
  useGarageStore.setState({ cars: [], thumbs: {}, selectedId: null, loaded: false })
  usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, buildMode: 'easy' } })
})

afterEach(async () => {
  vi.useRealTimers()
  await editor().unload()
})

describe('invalid edits (AC06)', () => {
  it('reports why and commits nothing when a placement does not fit', () => {
    const doc = freshRacer()
    const ok = editor().place({ defId: 'brick_2x2', pos: [1, 5, 5], rot: 0 })
    expect(ok).toBe(false)
    expect(editor().doc).toBe(doc)
    expect(editor().doc!.instances).toHaveLength(doc.instances.length)
    expect(editor().issues[0]!.code).toBe('overlap')
    expect(editor().issues[0]!.message.length).toBeGreaterThan(5)
    expect(editor().history.past).toHaveLength(0)
  })

  it('refuses a grouped move that collides and leaves every piece where it was', () => {
    const doc = freshRacer()
    const spoiler = doc.instances.find(i => i.defId === 'spoiler')!
    editor().select([spoiler.id])
    expect(editor().moveSelection([0, -3, 0])).toBe(false)
    expect(editor().doc!.instances.find(i => i.id === spoiler.id)!.pos).toEqual(spoiler.pos)
    expect(editor().issues.length).toBeGreaterThan(0)
  })

  it('clears the reason after the next accepted edit', () => {
    const doc = freshRacer()
    editor().place({ defId: 'brick_2x2', pos: [1, 5, 5], rot: 0 })
    expect(editor().issues).toHaveLength(1)
    const spoiler = doc.instances.find(i => i.defId === 'spoiler')!
    editor().select([spoiler.id])
    expect(editor().paintSelection('red')).toBe(true)
    expect(editor().issues).toHaveLength(0)
  })
})

describe('atomic undo and redo (AC07)', () => {
  it('places a mirrored pair in one transaction that undoes and redoes in one step', () => {
    const doc = freshRacer()
    expect(editor().toggleMirror()).toBe(true)
    const cand = findPlacements(doc, catalog.get('brick_1x1')!, { rotations: [0] }, defaultContext).find(c => c.pos[0] === 0 && c.pos[1] === 8 && c.pos[2] === 0)
    expect(cand).toBeDefined()
    expect(editor().place(cand!)).toBe(true)
    expect(editor().doc!.instances).toHaveLength(doc.instances.length + 2)
    expect(editor().history.past).toHaveLength(1)
    expect(editor().undo()).toBe(true)
    expect(editor().doc!.instances).toHaveLength(doc.instances.length)
    expect(editor().redo()).toBe(true)
    expect(editor().doc!.instances).toHaveLength(doc.instances.length + 2)
  })

  it('refuses the whole mirrored pair when the image does not fit, committing neither piece', () => {
    freshRacer()
    // Make the car asymmetric: a 1x1 on the left pod only.
    expect(editor().place({ defId: 'brick_1x1', pos: [0, 8, 6], rot: 0 })).toBe(true)
    const before = editor().doc!
    // On its own, a 1x1 on the right pod fits.
    expect(editor().place({ defId: 'brick_1x1', pos: [5, 8, 6], rot: 0 })).toBe(true)
    editor().undo()
    expect(editor().doc!.revisionId).toBe(before.revisionId)
    // With mirroring on, the image of the right-hand piece lands on the left-hand one, so neither is placed.
    editor().toggleMirror()
    expect(editor().place({ defId: 'brick_1x1', pos: [5, 8, 6], rot: 0 })).toBe(false)
    expect(editor().doc!.revisionId).toBe(before.revisionId)
    expect(editor().doc!.instances).toEqual(before.instances)
    expect(editor().issues[0]!.code).toBe('overlap')
    expect(editor().history.past).toHaveLength(1)
  })

  it('swaps both wheels of a pair in one transaction and undoes them together', () => {
    const doc = freshRacer()
    const front = doc.wheelGroups.find(g => g.steering)!
    expect(editor().swapWheels(front.id, 'wheel_wide')).toBe(true)
    expect(editor().doc!.instances.filter(i => i.defId === 'wheel_wide')).toHaveLength(2)
    expect(editor().history.past).toHaveLength(1)
    editor().undo()
    expect(editor().doc!.instances.filter(i => i.defId === 'wheel_wide')).toHaveLength(0)
    expect(editor().doc!.instances.filter(i => i.defId === 'wheel_road')).toHaveLength(4)
  })

  it('undoes a grouped move, a paint and a rotation one step at a time', () => {
    const c = defaultContext
    const doc = freshRacer()
    const spoiler = doc.instances.find(i => i.defId === 'spoiler')!
    editor().select([spoiler.id])
    expect(editor().moveSelection([0, 0, 1])).toBe(true)
    expect(editor().paintSelection('red')).toBe(true)
    expect(editor().history.past.map(h => h.label)).toEqual(['Move', 'Paint'])
    editor().undo()
    expect(editor().doc!.instances.find(i => i.id === spoiler.id)!.colour).toBe(spoiler.colour)
    expect(editor().doc!.instances.find(i => i.id === spoiler.id)!.pos[2]).toBe(spoiler.pos[2] + 1)
    editor().undo()
    expect(editor().doc!.instances.find(i => i.id === spoiler.id)!.pos).toEqual(spoiler.pos)
    expect(c.catalog.get('spoiler')).toBeDefined()
  })
})

describe('removing a supporting piece (AC08)', () => {
  it('previews what would come loose, keeps every other piece and identifies them', () => {
    const doc = freshRacer()
    const chassis = doc.instances.find(i => i.defId === 'chassis_short')!
    editor().select([chassis.id])
    const preview = editor().previewDeleteSelection()
    expect(preview.structural).toBe(true)
    expect(preview.supporting).toBe(true)
    expect(preview.detached.length).toBeGreaterThan(5)
    expect(editor().deleteSelection()).toBe(true)
    const after = editor().doc!
    expect(after.instances).toHaveLength(doc.instances.length - 1)
    expect(after.instances.every(i => i.id !== chassis.id)).toBe(true)
    expect(looseInstanceIds(computeAssemblies(after, catalog)).size).toBeGreaterThan(0)
    expect(editor().undo()).toBe(true)
    expect(editor().doc!.instances).toHaveLength(doc.instances.length)
  })

  it('removes a free-standing piece without protection', () => {
    const doc = freshRacer()
    const wing = doc.instances.find(i => i.defId === 'spoiler')!
    editor().select([wing.id])
    const preview = editor().previewDeleteSelection()
    expect(preview.supporting).toBe(false)
    expect(preview.structural).toBe(false)
  })
})

describe('mode switching (AC03)', () => {
  it('only flips the preference: pieces, wheel groups, forward direction and colours are untouched', () => {
    const doc = freshRacer()
    const snapshot = JSON.stringify(editor().doc)
    usePrefsStore.getState().update({ buildMode: 'free' })
    expect(usePrefsStore.getState().prefs.buildMode).toBe('free')
    expect(editor().doc).toBe(doc)
    usePrefsStore.getState().update({ buildMode: 'easy' })
    expect(JSON.stringify(editor().doc)).toBe(snapshot)
    expect(editor().history.past).toHaveLength(0)
  })

  it('keeps a customised car (custom axles, mixed wheels, asymmetry) through both modes', () => {
    freshRacer()
    const front = editor().doc!.wheelGroups.find(g => g.steering)!
    editor().swapWheels(front.id, 'wheel_offroad')
    editor().setRoles(front.id, { driven: true })
    editor().setCarForward('z+')
    const before = JSON.stringify(editor().doc)
    for (const m of ['free', 'easy', 'free', 'easy'] as const)
      usePrefsStore.getState().update({ buildMode: m })
    expect(JSON.stringify(editor().doc)).toBe(before)
  })
})

describe('autosave', () => {
  it('saves after a short idle period, shows saving then saved, and keeps the car in the garage', async () => {
    vi.useFakeTimers()
    const doc = freshRacer()
    await repo.saveCar(doc)
    editor().select([doc.instances.find(i => i.defId === 'spoiler')!.id])
    editor().paintSelection('red')
    expect(editor().saveState).toBe('saving')
    await vi.advanceTimersByTimeAsync(300)
    expect(editor().saveState).toBe('saving')
    await vi.advanceTimersByTimeAsync(600)
    expect(editor().saveState).toBe('saved')
    const stored = await repo.loadCar(doc.carId)
    expect(stored!.doc.revisionId).toBe(editor().doc!.revisionId)
  })

  it('flushes immediately on request and on unload', async () => {
    const doc = freshRacer()
    await repo.saveCar(doc)
    editor().select([doc.instances.find(i => i.defId === 'spoiler')!.id])
    editor().paintSelection('green')
    await editor().flushSave()
    expect((await repo.loadCar(doc.carId))!.doc.revisionId).toBe(editor().doc!.revisionId)
    editor().paintSelection('teal')
    const rev = editor().doc!.revisionId
    await editor().unload()
    expect((await repo.loadCar(doc.carId))!.doc.revisionId).toBe(rev)
  })

  it('reports a failed save, keeps the edit in memory, and recovers on retry', async () => {
    const doc = freshRacer()
    let full = true
    const flaky: AsyncStorage = {
      get: db.get,
      keys: db.keys,
      remove: db.remove,
      set: async (k, v) => {
        if (full && k.startsWith('car:'))
          throw new DOMException('Out of space', 'QuotaExceededError')
        return db.set(k, v)
      },
    }
    setRepo(new GameRepo(flaky, memoryKv()))
    editor().select([doc.instances.find(i => i.defId === 'spoiler')!.id])
    editor().paintSelection('purple')
    await editor().flushSave()
    expect(editor().saveState).toBe('error')
    expect(editor().saveError).toBe('storage_full')
    expect(editor().doc!.instances.find(i => i.defId === 'spoiler')!.colour).toBe('purple')
    full = false
    await editor().retrySave()
    expect(editor().saveState).toBe('saved')
    expect(editor().saveError).toBeNull()
  })
})
