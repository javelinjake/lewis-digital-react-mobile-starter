import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

/**
 * The game is landscape, so these projects use landscape phone and tablet profiles (Chromium only).
 * In sandboxes where Playwright's own browser download is unavailable, set
 * `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium` to use an installed Chromium.
 * WebGL runs on software rendering in headless mode; it verifies behaviour, not device performance.
 */
const port = Number(process.env.PREVIEW_PORT ?? 4173)
/** Set E2E_BASE_URL to test against a server you started yourself (skips the build + preview web server). */
const externalBase = process.env.E2E_BASE_URL
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

const launchOptions = {
  executablePath,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: { baseURL: externalBase ?? `http://127.0.0.1:${port}`, trace: 'off' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7 landscape'], launchOptions } },
    { name: 'tablet', use: { ...devices['iPad Pro 11 landscape'], browserName: 'chromium', defaultBrowserType: 'chromium', launchOptions } },
  ],
  webServer: externalBase
    ? undefined
    : {
        // A production bundle (with the end-to-end test hooks enabled) avoids dev-server re-optimisation reloads and matches what ships.
        command: `VITE_E2E=true pnpm exec vite build --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --port ${port} --strictPort --host 127.0.0.1`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        env: { ...process.env, VITE_BUILD_TARGET: 'web' } as Record<string, string>,
      },
})
