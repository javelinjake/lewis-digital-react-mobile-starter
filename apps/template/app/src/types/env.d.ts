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
  /** `package.json` version, set by config-vite. */
  readonly VITE_APP_VERSION: string
  /** Native build number when built by the release script (`BUILD_NUMBER`), otherwise empty. */
  readonly VITE_APP_BUILD: string
  /** `version+build`, the release name crash reports and source maps share. */
  readonly VITE_APP_RELEASE: string
  /** dev / staging / prod for native builds; the Vercel environment for the web. */
  readonly VITE_APP_ENV: string
  /** Sentry DSN (public). Crash reports are offered only when set. */
  readonly VITE_SENTRY_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppRuntimeConfig
    __ldTest?: {
      flush: () => Promise<void>
      pending: () => number
    }
    __ldNotesTest?: {
      setOffline: (offline: boolean) => void
      failNextWrite: () => void
      serverIds: () => string[]
      expireSession: () => void
    }
  }
}

export {}
