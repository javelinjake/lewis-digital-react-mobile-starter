/// <reference types="vite/client" />

interface AppRuntimeConfig {
  VITE_API_URL?: string
  VITE_FRONTEND_URL?: string
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_FRONTEND_URL?: string
  readonly VITE_DATA_MODE?: 'mock' | 'live'
  readonly VITE_ALLOW_MOCK_BUILD?: string
  /** '1': an offline playtest build. Mock data is kept in localStorage and Settings can skip time ahead. */
  readonly VITE_MOCK_PERSIST?: string
  readonly VITE_BUILD_TARGET?: 'web' | 'native'
  readonly VITE_PWA_DEV?: string
  /** RevenueCat's public SDK keys (not secrets). Without one, the shop says purchases are not available. */
  readonly VITE_REVENUECAT_IOS_KEY?: string
  readonly VITE_REVENUECAT_ANDROID_KEY?: string
  /** PostHog's public project key. Without it, nothing is recorded. */
  readonly VITE_POSTHOG_KEY?: string
  /** Links the shop shows. Both stores require them before an app with purchases is approved. */
  readonly VITE_TERMS_URL?: string
  readonly VITE_PRIVACY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppRuntimeConfig
    /** Mock data mode only: lets Playwright move the game clock forward (milliseconds added to now). */
    __pixelPitchClock?: {
      advance: (ms: number) => void
      offset: () => number
      setPass: (on: boolean) => void
    }
    /** Mock data mode only: the playtest tools in Settings. Each changes the saved mock club directly. */
    __pixelPitchPlaytest?: {
      status: () => { offsetMs: number, hasPass: boolean, hasClub: boolean }
      /** Moves the clock to just after the next daily reset: new goals, calendar day, free pack and gems. */
      nextDay: () => void
      /** Adds to the wallet, as a shop purchase or a gift would. */
      grant: (gift: { coins?: number, gems?: number, tokens?: number, packs?: number, starPacks?: number }) => void
      refillEnergy: () => void
      /** Marks today's goals as done, ready to claim. */
      finishGoals: () => void
      addPassXp: (xp: number) => void
      /** Deletes the club and puts the clock back to real time: the app starts again at New club. */
      reset: () => void
    }
  }
}

export {}
