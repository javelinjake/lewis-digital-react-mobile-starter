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
