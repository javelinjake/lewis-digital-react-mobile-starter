import { describe, expect, it } from 'vitest'
import { resolveBackendEnv, resolveMediaStorage, resolveServerUrl } from '../../src/env'

const production: Record<string, string | undefined> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@db.example/app',
  PAYLOAD_SECRET: 'unique-payload-secret',
  BETTER_AUTH_SECRET: 'unique-auth-secret-that-is-long-enough-123',
  RESEND_API_KEY: 're_123',
  EMAIL_FROM: 'App <app@mail.example.com>',
  APP_ORIGINS: 'https://app.example.com',
  MEDIA_STORAGE: 'local',
}

describe('resolveBackendEnv', () => {
  it('uses a local database, captured email and dev secrets outside production', () => {
    const env = resolveBackendEnv({ NODE_ENV: 'development' })
    expect(env.databaseUri).toContain('127.0.0.1:54330/template')
    expect(env.emailDeliveryMode).toBe('capture')
    expect(env.productionRuntime).toBe(false)
  })

  it('accepts a complete production configuration and prefers DATABASE_URI over DATABASE_URL', () => {
    const env = resolveBackendEnv({ ...production, DATABASE_URI: 'postgres://direct/app' })
    expect(env.databaseUri).toBe('postgres://direct/app')
    expect(env.emailDeliveryMode).toBe('resend')
  })

  it.each([
    ['DATABASE_URL', 'DATABASE_URI is required'],
    ['PAYLOAD_SECRET', 'PAYLOAD_SECRET must be a unique'],
    ['BETTER_AUTH_SECRET', 'BETTER_AUTH_SECRET must be a unique'],
    ['RESEND_API_KEY', 'RESEND_API_KEY is required'],
    ['APP_ORIGINS', 'APP_ORIGINS is required'],
  ])('refuses production without %s', (key, message) => {
    const env = { ...production }
    delete env[key]
    expect(() => resolveBackendEnv(env)).toThrow(message)
  })

  it('refuses the dev secret in production', () => {
    expect(() => resolveBackendEnv({ ...production, PAYLOAD_SECRET: 'dev-only-change-me' })).toThrow('PAYLOAD_SECRET')
    expect(() => resolveBackendEnv({ ...production, BETTER_AUTH_SECRET: 'dev-only-change-me' })).toThrow('BETTER_AUTH_SECRET')
  })

  it('refuses a short auth secret in production', () => {
    expect(() => resolveBackendEnv({ ...production, BETTER_AUTH_SECRET: 'too-short' })).toThrow('at least 32')
  })

  it('refuses captured email in production unless explicitly allowed', () => {
    expect(() => resolveBackendEnv({ ...production, EMAIL_DELIVERY_MODE: 'capture' })).toThrow('capture')
    expect(resolveBackendEnv({ ...production, EMAIL_DELIVERY_MODE: 'capture', CMS_ALLOW_CAPTURE: '1' }).emailDeliveryMode).toBe('capture')
  })

  it('does not demand production secrets while next build collects page data', () => {
    const env = resolveBackendEnv({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })
    expect(env.building).toBe(true)
    expect(env.productionRuntime).toBe(false)
  })

  it('allows switching sign-in rate limiting off only outside production', () => {
    expect(resolveBackendEnv({ AUTH_RATE_LIMIT: 'off' }).authRateLimit).toBe(false)
    expect(resolveBackendEnv({}).authRateLimit).toBe(true)
    expect(() => resolveBackendEnv({ ...production, AUTH_RATE_LIMIT: 'off' })).toThrow('only for tests')
  })

  it('rejects an unknown email delivery mode', () => {
    expect(() => resolveBackendEnv({ EMAIL_DELIVERY_MODE: 'smtp' })).toThrow('EMAIL_DELIVERY_MODE')
  })

  it('splits the sender name and address', () => {
    const env = resolveBackendEnv(production)
    expect(env.emailFrom).toBe('app@mail.example.com')
    expect(env.emailFromName).toBe('App')
  })
})

describe('resolveServerUrl', () => {
  it('prefers SERVER_URL, then Vercel hosts, then localhost', () => {
    expect(resolveServerUrl({ SERVER_URL: 'https://api.example.com/' })).toBe('https://api.example.com')
    expect(resolveServerUrl({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'api.example.com' })).toBe('https://api.example.com')
    expect(resolveServerUrl({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'api-git-x.vercel.app', VERCEL_URL: 'other.vercel.app' })).toBe('https://api-git-x.vercel.app')
    expect(resolveServerUrl({})).toBe('http://localhost:3001')
  })
})

describe('resolveMediaStorage', () => {
  const gcs = { GCS_BUCKET: 'b', GCS_PROJECT_ID: 'p', GCS_CLIENT_EMAIL: 'e@x', GCS_PRIVATE_KEY: 'k' }

  it('is local by default and gcs when fully configured', () => {
    expect(resolveMediaStorage({}, false)).toBe('local')
    expect(resolveMediaStorage(gcs, true)).toBe('gcs')
  })

  it('rejects a partial GCS configuration', () => {
    expect(() => resolveMediaStorage({ GCS_BUCKET: 'b' }, false)).toThrow('Incomplete GCS')
  })

  it('requires explicit local storage in production without GCS', () => {
    expect(() => resolveMediaStorage({}, true)).toThrow('Production needs GCS')
    expect(resolveMediaStorage({ MEDIA_STORAGE: 'local' }, true)).toBe('local')
  })
})
