/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_TARGET?: 'web' | 'native'
  readonly VITE_PWA_DEV?: string
  /** Set to 'true' only for end-to-end builds. Enables read-only test hooks and car seeding. */
  readonly VITE_E2E?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}
