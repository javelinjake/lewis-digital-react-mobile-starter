/// <reference types="vite/client" />

interface AppRuntimeConfig {
  VITE_DIRECTUS_URL?: string
  VITE_FRONTEND_URL?: string
}

interface ImportMetaEnv {
  readonly VITE_DIRECTUS_URL: string
  readonly VITE_FRONTEND_URL: string
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
    }
  }
}

export {}
