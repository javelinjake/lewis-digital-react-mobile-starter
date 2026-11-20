import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

export interface CreateVitestConfigOptions {
  root: string
  setupFiles?: string[]
  /** `jsdom` for UI code (default), `node` for server and pure-logic packages. */
  environment?: 'jsdom' | 'node'
}

export function createVitestConfig(options: CreateVitestConfigOptions): ViteUserConfig {
  const { root, environment = 'jsdom', setupFiles = environment === 'jsdom' ? ['./tests/unit/setup.ts'] : [] } = options

  return defineConfig({
    root,
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', `file://${root}/`)),
      },
    },
    test: {
      environment,
      include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.spec.tsx'],
      setupFiles,
    },
  })
}
