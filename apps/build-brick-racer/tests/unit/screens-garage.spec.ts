import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareTryACar } from '@/features/garage/lib/try-a-car'
import { getChallenge } from '@/game/challenges'
import { useGarageStore } from '@/stores/garage.store'
import { useSessionStore } from '@/stores/session.store'
import { freshRepo, outcomeOf, runRecord } from './screens-helpers'

// The renderer needs WebGL, which jsdom does not have. Thumbnails fall back to the generated image.
vi.mock('@/render', () => ({
  renderCarThumbnail: async () => null,
  fallbackThumbnail: (name: string) => `data:image/svg+xml;utf8,${encodeURIComponent(name)}`,
}))

describe('garage (AC27)', () => {
  beforeEach(() => {
    freshRepo()
  })

  it('creates a starter, selects it and keeps it after a reload', async () => {
    const doc = await useGarageStore.getState().create('racer')
    expect(doc!.name).toBe('Racer')
    expect(useGarageStore.getState().cars.map(c => c.name)).toEqual(['Racer'])
    expect(useGarageStore.getState().selectedId).toBe(doc!.carId)

    useGarageStore.setState({ cars: [], selectedId: null })
    await useGarageStore.getState().refresh()
    expect(useGarageStore.getState().cars).toHaveLength(1)
    expect(useGarageStore.getState().selectedId).toBe(doc!.carId)
  })

  it('renames and duplicates a car, and both persist', async () => {
    const doc = (await useGarageStore.getState().create('buggy'))!
    await useGarageStore.getState().rename(doc.carId, '  Mud Monster ')
    expect(useGarageStore.getState().cars[0]!.name).toBe('Mud Monster')

    const copy = (await useGarageStore.getState().duplicate(doc.carId))!
    expect(copy.carId).not.toBe(doc.carId)
    expect(copy.name).toBe('Mud Monster copy')
    const names = useGarageStore.getState().cars.map(c => c.name).sort()
    expect(names).toEqual(['Mud Monster', 'Mud Monster copy'])
    expect(useGarageStore.getState().selectedId).toBe(copy.carId)
  })

  it('deleting a car keeps the snapshots and runs that reference it', async () => {
    const { repo } = freshRepo()
    const doc = (await useGarageStore.getState().create('racer'))!
    const snapshotId = await repo.saveSnapshot(doc)
    const run = runRecord({ carId: doc.carId, carSnapshotId: snapshotId })
    await repo.commitRun(run, getChallenge('garden_mud')!, outcomeOf(run), null)

    await useGarageStore.getState().remove(doc.carId)
    expect(useGarageStore.getState().cars).toHaveLength(0)
    expect(await repo.loadCar(doc.carId)).toBeNull()
    expect((await repo.getSnapshot(snapshotId))!.doc.name).toBe('Racer')
    expect((await repo.getRun(run.id))!.carSnapshotId).toBe(snapshotId)
  })

  it('try a car sets up the Racer in the Kitchen Ramp Run with steering help, and reuses an existing Racer', async () => {
    const id = await prepareTryACar()
    const s = useSessionStore.getState()
    expect(s.carId).toBe(id)
    expect(s.place).toBe('kitchen')
    expect(s.challengeId).toBe('kitchen_sprint')
    expect(s.assist).toBe('light')
    expect(s.trying).toBe(true)
    const again = await prepareTryACar()
    expect(again).toBe(id)
    expect(useGarageStore.getState().cars).toHaveLength(1)
  })
})
