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
  readonly VITE_BUILD_TARGET?: 'web' | 'native'
  readonly VITE_PWA_DEV?: string
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
    }
  }
}

export {}
