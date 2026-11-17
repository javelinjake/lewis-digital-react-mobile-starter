import { useEffect, useState } from 'react'
import { getRepo } from '@/lib/platform/repo'
import { useEditorStore } from '@/stores/editor.store'
import { useGarageStore } from '@/stores/garage.store'
import { usePrefsStore } from '@/stores/prefs.store'
import { useSessionStore } from '@/stores/session.store'

export type LoaderState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready', recovered: boolean, migrated: boolean }

/** The previous editor is flushed and cleared before the next car loads (also under Strict Mode). */
let pendingUnload: Promise<void> = Promise.resolve()

/** Load a car into the editor store. Unloading flushes the save. */
export function useCarLoader(carId: string | undefined): LoaderState {
  const [state, setState] = useState<LoaderState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setState({ status: 'loading' })
      if (!carId) {
        setState({ status: 'missing' })
        return
      }
      try {
        await pendingUnload
        const loaded = await getRepo().loadCar(carId)
        if (cancelled)
          return
        if (!loaded) {
          setState({ status: 'missing' })
          return
        }
        useEditorStore.getState().load(loaded.doc)
        useSessionStore.getState().chooseCar(carId)
        useGarageStore.getState().select(carId)
        // "Start empty" opens Free Build: a brand-new empty car switches the preference once.
        if (loaded.doc.instances.length === 0 && loaded.doc.starterId === null && usePrefsStore.getState().prefs.buildMode === 'easy')
          usePrefsStore.getState().update({ buildMode: 'free' })
        setState({ status: 'ready', recovered: loaded.recovered, migrated: loaded.migrated })
      }
      catch {
        if (!cancelled)
          setState({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
      pendingUnload = useEditorStore.getState().unload()
    }
  }, [carId])

  return state
}
