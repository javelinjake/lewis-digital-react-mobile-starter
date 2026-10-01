import type { PwaConfigOptions } from './pwa.ts'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type PluginOption, type UserConfig } from 'vite'
import { createPwaPlugin } from './pwa.ts'

export type { PwaConfigOptions } from './pwa.ts'
export type BuildTarget = 'web' | 'native'

export interface CreateViteConfigOptions {
  root: string
  port?: number
  /** `native` omits the service worker. IndexedDB caching stays available either way. */
  buildTarget?: BuildTarget
  /** Enable the PWA service worker and manifest. Ignored for native builds. */
  pwa?: PwaConfigOptions
}

export function createViteConfig(options: CreateViteConfigOptions): UserConfig {
  const { root, port = 5173, pwa, buildTarget = 'web' } = options
  const plugins: PluginOption[] = [react(), tailwindcss()]

  if (buildTarget !== 'native' && pwa)
    plugins.push(createPwaPlugin(pwa))

  return defineConfig({
    root,
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', `file://${root}/`)),
        ...(buildTarget === 'native'
          ? { 'virtual:pwa-register': fileURLToPath(new URL('../../pwa/src/register-stub.ts', import.meta.url)) }
          : {}),
      },
    },
    server: {
      port,
      host: true,
    },
  })
}
