import type { PlayerPreferences } from '@/game/persistence/types'
import { create } from 'zustand'
import { DEFAULT_PREFERENCES } from '@/game/persistence/types'
import { getRepo } from '@/lib/platform/repo'

interface PrefsState {
  prefs: PlayerPreferences
  hydrated: boolean
  hydrate: () => Promise<void>
  update: (patch: Partial<PlayerPreferences>) => void
  updateControls: (patch: Partial<PlayerPreferences['controls']>) => void
  updateAudio: (patch: Partial<PlayerPreferences['audio']>) => void
  completeTutorial: (id: string) => void
  resetTutorial: () => void
}

function applyToDocument(prefs: PlayerPreferences) {
  if (typeof document !== 'undefined')
    document.documentElement.dataset.reducedMotion = String(prefs.reducedMotion)
}

export const usePrefsStore = create<PrefsState>((set, get) => {
  const commit = (next: PlayerPreferences) => {
    set({ prefs: next })
    applyToDocument(next)
    void getRepo().savePrefs(next)
  }
  return {
    prefs: DEFAULT_PREFERENCES,
    hydrated: false,
    async hydrate() {
      const prefs = await getRepo().loadPrefs()
      applyToDocument(prefs)
      set({ prefs, hydrated: true })
    },
    update: patch => commit({ ...get().prefs, ...patch }),
    updateControls: patch => commit({ ...get().prefs, controls: { ...get().prefs.controls, ...patch } }),
    updateAudio: patch => commit({ ...get().prefs, audio: { ...get().prefs.audio, ...patch } }),
    completeTutorial: (id) => {
      const t = get().prefs.tutorial
      if (!t.completed.includes(id))
        commit({ ...get().prefs, tutorial: { ...t, completed: [...t.completed, id] } })
    },
    resetTutorial: () => commit({ ...get().prefs, tutorial: { completed: [], dismissed: false } }),
  }
})
