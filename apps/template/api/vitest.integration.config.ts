import path from 'node:path'
import process from 'node:process'
import { defineConfig } from 'vitest/config'

// These tests need Postgres (`pnpm db:up`). They run against the `template_test` database, which is wiped each run.
export default defineConfig({
  resolve: { alias: { '@payload-config': path.resolve('payload.config.ts') } },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.spec.ts'],
    // One shared database, so files run one after another.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
    env: {
      CMS_LOCAL_DATABASE: process.env.CMS_LOCAL_DATABASE ?? 'template_test',
      EMAIL_CAPTURE_DIR: path.resolve('.data/test-mail'),
      MEDIA_DIR: path.resolve('.data/test-uploads'),
      APP_ORIGINS: 'http://localhost:5173',
      REVENUECAT_WEBHOOK_SECRET: 'test-revenuecat-secret',
      CRON_SECRET: 'test-cron-secret',
      // Many guests sign in from one address during a run. tests/integration/rate-limit.spec.ts turns it back on.
      AUTH_RATE_LIMIT: 'off',
    },
  },
})
