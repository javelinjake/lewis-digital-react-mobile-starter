import { Buffer } from 'node:buffer'
import process from 'node:process'

/** Any string map. `process.env` fits, and so does a literal in a test. */
export type Env = Record<string, string | undefined>

export type EmailDeliveryMode = 'capture' | 'resend'
export type MediaStorage = 'local' | 'gcs'

const GCS_KEYS = ['GCS_BUCKET', 'GCS_PROJECT_ID', 'GCS_CLIENT_EMAIL', 'GCS_PRIVATE_KEY'] as const
const DEV_SECRET = 'dev-only-change-me'

export interface BackendEnv {
  nodeEnv: string
  /** True while `next build` collects page data. Secrets and email are not needed then. */
  building: boolean
  productionRuntime: boolean
  databaseUri: string
  payloadSecret: string
  authSecret: string
  /** Public URL of this backend, e.g. https://api.example.com. */
  serverUrl: string
  appOrigins: string
  emailDeliveryMode: EmailDeliveryMode
  emailFrom: string
  emailFromName: string
  resendApiKey?: string
  captureDir: string
  revenuecatWebhookSecret?: string
  cronSecret?: string
  /** Better Auth's built-in rate limiting. Only ever off outside production (tests). */
  authRateLimit: boolean
  mediaStorage: MediaStorage
  mediaDir: string
  gcsBucket?: string
  gcsProjectId?: string
  gcsClientEmail?: string
  gcsPrivateKey?: string
  gcsPrefix: string
}

export function isProductionBuild(env: Env) {
  return env.NEXT_PHASE === 'phase-production-build'
}

/** Neon's Vercel integration sets DATABASE_URL, so accept it when DATABASE_URI is not set. */
export function resolveDatabaseUri(env: Env) {
  return env.DATABASE_URI?.trim() || env.DATABASE_URL?.trim() || ''
}

function devDatabaseUri(env: Env) {
  const database = env.CMS_LOCAL_DATABASE || 'template'
  if (!/^[a-z0-9_]+$/.test(database))
    throw new Error('CMS_LOCAL_DATABASE must be a local database name')
  return `postgres://payload:payload@127.0.0.1:54330/${database}`
}

/** SERVER_URL wins. On Vercel, fall back to the production domain or the deployment's own URL. */
export function resolveServerUrl(env: Env = process.env) {
  const explicit = env.SERVER_URL?.trim()
  if (explicit)
    return explicit.replace(/\/$/, '')

  const host = env.VERCEL_ENV === 'production'
    ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
    : env.VERCEL_BRANCH_URL || env.VERCEL_URL
  if (host)
    return `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}`

  return 'http://localhost:3001'
}

export function resolveBackendEnv(env: Env = process.env): BackendEnv {
  const databaseUri = resolveDatabaseUri(env)
  const nodeEnv = env.NODE_ENV ?? 'development'
  const building = isProductionBuild(env)
  const productionRuntime = nodeEnv === 'production' && !building

  if (env.EMAIL_DELIVERY_MODE && env.EMAIL_DELIVERY_MODE !== 'capture' && env.EMAIL_DELIVERY_MODE !== 'resend')
    throw new Error('EMAIL_DELIVERY_MODE must be capture or resend')

  const emailDeliveryMode: EmailDeliveryMode = env.EMAIL_DELIVERY_MODE === 'resend'
    ? 'resend'
    : env.EMAIL_DELIVERY_MODE === 'capture'
      ? 'capture'
      : productionRuntime ? 'resend' : 'capture'

  if (productionRuntime) {
    if (!databaseUri)
      throw new Error('DATABASE_URI is required in production')
    if (!env.PAYLOAD_SECRET || env.PAYLOAD_SECRET === DEV_SECRET)
      throw new Error('PAYLOAD_SECRET must be a unique production secret')
    if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET === DEV_SECRET)
      throw new Error('BETTER_AUTH_SECRET must be a unique production secret')
    if (env.BETTER_AUTH_SECRET.length < 32)
      throw new Error('BETTER_AUTH_SECRET must be at least 32 characters. Generate one with `openssl rand -base64 32`.')
    if (emailDeliveryMode === 'capture' && env.CMS_ALLOW_CAPTURE !== '1')
      throw new Error('Production cannot use EMAIL_DELIVERY_MODE=capture')
    if (emailDeliveryMode === 'resend' && !env.RESEND_API_KEY)
      throw new Error('RESEND_API_KEY is required when EMAIL_DELIVERY_MODE=resend')
    if (emailDeliveryMode === 'resend' && !env.EMAIL_FROM)
      throw new Error('EMAIL_FROM is required for Resend delivery')
    if (env.AUTH_RATE_LIMIT === 'off')
      throw new Error('AUTH_RATE_LIMIT=off is only for tests. Production keeps sign-in rate limiting on.')
    if (!env.APP_ORIGINS?.trim())
      throw new Error('APP_ORIGINS is required in production (the web origins allowed to call this API)')
  }

  const from = splitFrom(env.EMAIL_FROM || 'App <app@notifications.example.com>')

  return {
    nodeEnv,
    building,
    productionRuntime,
    databaseUri: databaseUri || (productionRuntime ? '' : devDatabaseUri(env)),
    payloadSecret: env.PAYLOAD_SECRET || DEV_SECRET,
    authSecret: env.BETTER_AUTH_SECRET || DEV_SECRET,
    serverUrl: resolveServerUrl(env),
    appOrigins: env.APP_ORIGINS ?? '',
    emailDeliveryMode,
    emailFrom: from.address,
    emailFromName: from.name,
    resendApiKey: env.RESEND_API_KEY,
    captureDir: env.EMAIL_CAPTURE_DIR || '.data/mail',
    revenuecatWebhookSecret: env.REVENUECAT_WEBHOOK_SECRET?.trim() || undefined,
    cronSecret: env.CRON_SECRET?.trim() || undefined,
    authRateLimit: env.AUTH_RATE_LIMIT !== 'off',
    mediaStorage: resolveMediaStorage(env, productionRuntime),
    mediaDir: env.MEDIA_DIR || '.data/uploads',
    gcsBucket: env.GCS_BUCKET,
    gcsProjectId: env.GCS_PROJECT_ID,
    gcsClientEmail: env.GCS_CLIENT_EMAIL,
    gcsPrivateKey: gcsPrivateKey(env.GCS_PRIVATE_KEY),
    gcsPrefix: (env.GCS_PREFIX || '').replace(/^\/+|\/+$/g, ''),
  }
}

export function resolveMediaStorage(env: Env, productionRuntime: boolean): MediaStorage {
  const requested = env.MEDIA_STORAGE?.trim()
  if (requested && requested !== 'local' && requested !== 'gcs')
    throw new Error('MEDIA_STORAGE must be local or gcs')

  const missing = GCS_KEYS.filter(key => !env[key]?.trim())
  if (missing.length > 0 && missing.length < GCS_KEYS.length)
    throw new Error(`Incomplete GCS configuration. Missing ${missing.join(', ')}. Set every GCS variable, or remove the partial values and set MEDIA_STORAGE=local.`)

  if (requested === 'local')
    return 'local'
  if (requested === 'gcs' && missing.length > 0)
    throw new Error(`Incomplete GCS configuration. Missing ${missing.join(', ')}.`)
  if (missing.length === 0)
    return 'gcs'
  if (productionRuntime)
    throw new Error('Production needs GCS_BUCKET, GCS_PROJECT_ID, GCS_CLIENT_EMAIL and GCS_PRIVATE_KEY, or MEDIA_STORAGE=local.')

  return 'local'
}

export function gcsPrivateKey(value: string | undefined) {
  if (!value?.trim())
    return undefined

  let key = unquote(value.trim())
  if (/^[A-Z0-9+/=\s]+$/i.test(key)) {
    const decoded = unquote(Buffer.from(key, 'base64').toString('utf8').trim())
    if (decoded.includes('-----BEGIN') || decoded.startsWith('{'))
      key = decoded
  }

  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key) as { private_key?: unknown }
      if (typeof parsed.private_key === 'string' && parsed.private_key.trim())
        key = parsed.private_key.trim()
    }
    catch {
      // Leave a non-JSON value for the signer to reject.
    }
  }

  return pemKey(key)
}

function unquote(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\'')))
    return value.slice(1, -1).trim()
  return value
}

function pemKey(key: string) {
  const text = key.replace(/\\+r/g, '').replace(/\\+n/g, '\n').replace(/\r/g, '')
  const match = text.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/)
  if (!match)
    return text
  const body = match[2].replace(/[^A-Z0-9+/=]/gi, '').match(/.{1,64}/g) ?? []
  return [`-----BEGIN ${match[1]}-----`, ...body, `-----END ${match[1]}-----`].join('\n')
}

function splitFrom(value: string) {
  const end = value.endsWith('>') ? value.lastIndexOf('<') : -1
  if (end === -1)
    return { name: 'App', address: value.trim() }
  return { name: value.slice(0, end).trim() || 'App', address: value.slice(end + 1, -1).trim() }
}
