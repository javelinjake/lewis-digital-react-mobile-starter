import process from 'node:process'
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

export interface CreatePlaywrightConfigOptions {
  testDir?: string
  previewPort?: number
}

/**
 * Mobile-first projects: Android phone, iOS phone (WebKit) and tablet.
 * Offline flows toggle `context.setOffline(true)` inside the test after the first load.
 */
export function createPlaywrightConfig(options: CreatePlaywrightConfigOptions = {}): PlaywrightTestConfig {
  const { testDir = './tests/e2e', previewPort = 4173 } = options

  return defineConfig({
    testDir,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'list',
    use: {
      baseURL: `http://localhost:${previewPort}`,
      trace: 'on-first-retry',
    },
    projects: [
      {
        name: 'phone',
        use: { ...devices['Pixel 7'] },
      },
      {
        name: 'phone-ios',
        use: { ...devices['iPhone 15'] },
      },
      {
        name: 'tablet',
        use: { ...devices['iPad Pro 11'] },
      },
    ],
    webServer: {
      command: `pnpm dev --port ${previewPort} --strictPort`,
      url: `http://localhost:${previewPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_BUILD_TARGET: 'web',
        VITE_DIRECTUS_URL: process.env.VITE_DIRECTUS_URL ?? 'http://localhost:8055',
        VITE_FRONTEND_URL: process.env.VITE_FRONTEND_URL ?? `http://localhost:${previewPort}`,
      },
    },
  })
}
