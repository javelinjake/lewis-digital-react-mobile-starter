/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_TARGET?: 'web' | 'native'
  readonly VITE_PWA_DEV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}
