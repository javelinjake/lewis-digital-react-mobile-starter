import type { CarDocument } from '@/game/build/types'
import { useEffect, useState } from 'react'
import { getRepo } from '@/lib/platform/repo'
import { useGarageStore } from '@/stores/garage.store'

/**
 * Load a saved car by id. Reloads when the garage list reports a newer save, so edits made in the builder
 * show up when you come back. `missing` is true when the id is set but nothing readable is stored.
 */
export function useCarDoc(carId: string | null): { doc: CarDocument | null, loading: boolean, missing: boolean } {
  const updatedAt = useGarageStore(s => s.cars.find(c => c.id === carId)?.updatedAt)
  const [state, setState] = useState<{ id: string | null, doc: CarDocument | null, loading: boolean, missing: boolean }>({ id: null, doc: null, loading: false, missing: false })

  useEffect(() => {
    if (!carId) {
      setState({ id: null, doc: null, loading: false, missing: false })
      return
    }
    let cancelled = false
    setState(s => ({ ...s, loading: s.id !== carId }))
    void getRepo().loadCar(carId).then((loaded) => {
      if (!cancelled)
        setState({ id: carId, doc: loaded?.doc ?? null, loading: false, missing: !loaded })
    }).catch(() => {
      if (!cancelled)
        setState({ id: carId, doc: null, loading: false, missing: true })
    })
    return () => {
      cancelled = true
    }
  }, [carId, updatedAt])

  return { doc: state.id === carId ? state.doc : null, loading: state.loading, missing: state.id === carId && state.missing }
}
