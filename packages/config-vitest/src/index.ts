import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type UserConfig } from 'vitest/config'

export interface CreateVitestConfigOptions {
  root: string
  setupFiles?: string[]
}

export function createVitestConfig(options: CreateVitestConfigOptions): UserConfig {
  const { root, setupFiles = ['./tests/unit/setup.ts'] } = options

  return defineConfig({
    root,
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', `file://${root}/`)),
      },
    },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.spec.tsx'],
      setupFiles,
    },
  })
}
