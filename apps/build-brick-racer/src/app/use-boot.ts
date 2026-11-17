import { hideSplashScreen, setStatusBarAppearance } from '@ld/native'
import { useEffect } from 'react'
import { appConfig } from '@/config/app.config'
import { getRepo } from '@/lib/platform/repo'
import { useGarageStore } from '@/stores/garage.store'
import { usePrefsStore } from '@/stores/prefs.store'
import { useSessionStore } from '@/stores/session.store'

/**
 * Startup, in order: preferences, finish any interrupted save, read the garage, note an interrupted run,
 * trim replay storage. Nothing here needs the network.
 */
export function useBoot() {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const repo = getRepo()
      await usePrefsStore.getState().hydrate()
      await repo.recoverJournal().catch(() => 0)
      await useGarageStore.getState().refresh()
      const interrupted = await repo.takeInterrupted().catch(() => null)
      if (!cancelled && interrupted)
        useSessionStore.getState().setInterrupted(interrupted)
      void repo.enforceReplayBudget(appConfig.replayBudgetBytes).catch(() => [])
      void setStatusBarAppearance({ light: true, backgroundColor: '#0b1f3a' })
      void hideSplashScreen()
    })()
    return () => {
      cancelled = true
    }
  }, [])
}
