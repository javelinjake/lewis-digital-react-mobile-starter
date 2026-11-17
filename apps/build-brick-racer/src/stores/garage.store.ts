import type { CarDocument } from '@/game/build/types'
import type { CarSummary } from '@/game/persistence/repo'
import { create } from 'zustand'
import { createEmptyDoc, defaultContext, duplicateCarDoc } from '@/game/build/doc'
import { renameCar } from '@/game/build/edit'
import { buildStarter } from '@/game/catalog/starters'
import { getRepo } from '@/lib/platform/repo'
import { usePrefsStore } from '@/stores/prefs.store'

export type NewCarKind = 'racer' | 'buggy' | 'empty'

interface GarageState {
  cars: CarSummary[]
  thumbs: Record<string, string>
  loaded: boolean
  error: string | null
  /** Id of the car shown large in the garage and used for Drive. */
  selectedId: string | null
  refresh: () => Promise<void>
  select: (id: string | null) => void
  create: (kind: NewCarKind) => Promise<CarDocument | null>
  duplicate: (id: string) => Promise<CarDocument | null>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Render and store a thumbnail. Never throws; a generated fallback is used on failure. */
  refreshThumbnail: (doc: CarDocument) => Promise<void>
}

export const useGarageStore = create<GarageState>((set, get) => ({
  cars: [],
  thumbs: {},
  loaded: false,
  error: null,
  selectedId: null,

  async refresh() {
    try {
      const repo = getRepo()
      const cars = await repo.listCars()
      const thumbs: Record<string, string> = { ...get().thumbs }
      for (const car of cars) {
        const stored = await repo.getThumbnail(car.id)
        if (stored)
          thumbs[car.id] = stored
      }
      const last = usePrefsStore.getState().prefs.lastCarId
      const current = get().selectedId
      const selectedId = (current && cars.some(c => c.id === current)) ? current : (last && cars.some(c => c.id === last)) ? last : (cars[0]?.id ?? null)
      set({ cars, thumbs, loaded: true, error: null, selectedId })
    }
    catch {
      set({ loaded: true, error: 'The garage could not be read from this device.' })
    }
  },

  select(id) {
    set({ selectedId: id })
    if (id)
      usePrefsStore.getState().update({ lastCarId: id })
  },

  async create(kind) {
    const doc = kind === 'empty' ? createEmptyDoc(defaultContext, 'My car') : buildStarter(kind, defaultContext)
    const named = kind === 'empty' ? doc : { ...doc, name: kind === 'racer' ? 'Racer' : 'Buggy' }
    const saved = await getRepo().saveCar(named)
    if (!saved.ok) {
      set({ error: saved.error === 'storage_full' ? 'This device is full, so the car could not be saved.' : 'The car could not be saved.' })
      return null
    }
    await get().refresh()
    get().select(named.carId)
    void get().refreshThumbnail(named)
    return named
  },

  async duplicate(id) {
    const loaded = await getRepo().loadCar(id)
    if (!loaded)
      return null
    const copy = duplicateCarDoc(loaded.doc, defaultContext)
    const saved = await getRepo().saveCar(copy)
    if (!saved.ok)
      return null
    await get().refresh()
    get().select(copy.carId)
    void get().refreshThumbnail(copy)
    return copy
  },

  async rename(id, name) {
    const loaded = await getRepo().loadCar(id)
    if (!loaded)
      return
    await getRepo().saveCar(renameCar(loaded.doc, name, defaultContext))
    await get().refresh()
  },

  async remove(id) {
    await getRepo().deleteCar(id)
    const thumbs = { ...get().thumbs }
    delete thumbs[id]
    set({ thumbs })
    if (get().selectedId === id)
      set({ selectedId: null })
    await get().refresh()
  },

  async refreshThumbnail(doc) {
    let url: string | null = null
    try {
      const render = await import('@/render')
      const { catalog } = await import('@/game/catalog/catalog')
      url = await render.renderCarThumbnail(doc, catalog, { size: 360 })
      url ??= render.fallbackThumbnail(doc.name)
    }
    catch {
      url = null
    }
    if (!url)
      return
    await getRepo().saveThumbnail(doc.carId, url)
    set(s => ({ thumbs: { ...s.thumbs, [doc.carId]: url } }))
  },
}))
