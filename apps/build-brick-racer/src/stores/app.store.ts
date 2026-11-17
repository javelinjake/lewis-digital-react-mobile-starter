import { create } from 'zustand'

/** App-level lifecycle signals shared across screens. */
interface AppState {
  /** True while the Drive screen is live. Blocks update prompts and similar interruptions. */
  driving: boolean
  /** Bumped every time the app goes to the background. Screens react by pausing and releasing input. */
  backgroundedTick: number
  setDriving: (driving: boolean) => void
  notifyBackgrounded: () => void
}

export const useAppStore = create<AppState>(set => ({
  driving: false,
  backgroundedTick: 0,
  setDriving: driving => set({ driving }),
  notifyBackgrounded: () => set(s => ({ backgroundedTick: s.backgroundedTick + 1 })),
}))
