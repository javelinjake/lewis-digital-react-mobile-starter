import type { CollectionConfig, Config, Endpoint, GlobalConfig, Payload, Plugin } from 'payload'
import type { AuthMethods } from './auth/options'
import type { CronOptions } from './endpoints/cron'
import type { PurchaseOptions } from './endpoints/revenuecat'
import path from 'node:path'
import { betterAuthCollections, createBetterAuthPlugin, payloadAdapter } from '@delmaredigital/payload-better-auth'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { gcsStorage } from '@payloadcms/storage-gcs'
import { betterAuth } from 'better-auth'
import sharp from 'sharp'
import { buildAuthOptions } from './auth/options'
import { devicesCollection } from './collections/devices'
import { idempotencyKeysCollection, rateLimitsCollection } from './collections/internal'
import { privateMediaCollection } from './collections/private-media'
import { entitlementsCollection, purchaseEventsCollection } from './collections/purchases'
import { usersCollection } from './collections/users'
import { createEmailAdapter } from './email'
import { deleteAccountEndpoint, exportAccountEndpoint } from './endpoints/account'
import { createCleanupEndpoint } from './endpoints/cron'
import { assertNoShadowedEndpoints } from './endpoints/guard'
import { healthEndpoint } from './endpoints/health'
import { createRevenueCatEndpoint } from './endpoints/revenuecat'
import { resolveBackendEnv } from './env'
import { buildAllowedOrigins } from './origins'

export interface AppBackendOptions {
  app: {
    name: string
    /** `app.meta.hostname`. Used for the native WebView origins. */
    hostname?: string
  }
  migrationDir: string
  typesOutputFile: string
  importMapBaseDir: string
  /** Which sign-in methods this app offers. */
  auth: AuthMethods
  /** The app's own collections. Declare any that hold user data with `ownedCollection`. */
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]
  plugins?: Plugin[]
  /** Server-authoritative actions built with `defineAction`. */
  endpoints?: Endpoint[]
  purchases?: Pick<PurchaseOptions, 'onEvent'>
  cron?: Pick<CronOptions, 'extra'>
  adminMeta?: NonNullable<Config['admin']>['meta']
  adminComponents?: NonNullable<Config['admin']>['components']
}

/**
 * Payload options for one app's backend: Postgres, Better Auth (cookie on the web, bearer token on native),
 * owner-scoped user data, idempotent actions, RevenueCat purchases, account deletion and export.
 * Pass the result to `buildConfig`.
 */
export function createAppBackend(options: AppBackendOptions) {
  const env = resolveBackendEnv()
  const origins = buildAllowedOrigins({
    appOrigins: env.appOrigins,
    hostname: options.app.hostname,
    development: !env.productionRuntime,
  })

  // Better Auth's email callbacks run after Payload has started, so they reach it through this reference.
  let ready: Payload | undefined
  const authOptions = buildAuthOptions({
    appName: options.app.name,
    env,
    methods: options.auth,
    trustedOrigins: origins,
  }, () => ready)

  assertNoShadowedEndpoints(options.endpoints ?? [], [
    ...(options.collections ?? []).map(collection => collection.slug),
    ...(options.globals ?? []).map(global => global.slug),
    'users',
    'private-media',
    'devices',
    'entitlements',
    'purchase-events',
    'idempotency-keys',
    'action-throttles',
  ])

  const uploadDir = path.resolve(env.mediaDir)
  const gcsReady = env.mediaStorage === 'gcs' && env.gcsBucket && env.gcsProjectId && env.gcsClientEmail && env.gcsPrivateKey

  return {
    admin: {
      user: 'users',
      importMap: { baseDir: options.importMapBaseDir },
      ...(options.adminMeta ? { meta: options.adminMeta } : {}),
      ...(options.adminComponents ? { components: options.adminComponents } : {}),
    },
    collections: [
      usersCollection,
      privateMediaCollection(uploadDir),
      devicesCollection,
      entitlementsCollection,
      purchaseEventsCollection,
      idempotencyKeysCollection,
      rateLimitsCollection,
      ...(options.collections ?? []),
    ],
    globals: options.globals ?? [],
    endpoints: [
      healthEndpoint,
      deleteAccountEndpoint,
      exportAccountEndpoint,
      createRevenueCatEndpoint({ secret: env.revenuecatWebhookSecret, onEvent: options.purchases?.onEvent }),
      createCleanupEndpoint({ secret: env.cronSecret, extra: options.cron?.extra }),
      ...(options.endpoints ?? []),
    ],
    plugins: [
      betterAuthCollections({
        betterAuthOptions: authOptions,
        skipCollections: ['user'],
        adminGroup: 'Auth',
        // The first account on an empty database becomes the administrator, and everyone after is a member.
        // `cms:bootstrap-admin` creates that first account before the API is exposed (see scripts/vercel-build.ts).
        firstUserAdmin: { adminRole: 'admin', defaultRole: 'member' },
      }),
      createBetterAuthPlugin({
        createAuth: (payload) => {
          ready = payload
          return betterAuth({ ...authOptions, database: payloadAdapter({ payloadClient: payload }) })
        },
      }),
      ...(gcsReady
        ? [gcsStorage({
            collections: { 'private-media': { prefix: env.gcsPrefix ? `${env.gcsPrefix}/private` : 'private' } },
            bucket: env.gcsBucket!,
            options: { projectId: env.gcsProjectId, credentials: { client_email: env.gcsClientEmail!, private_key: env.gcsPrivateKey! } },
          })]
        : []),
      ...(options.plugins ?? []),
    ],
    serverURL: env.serverUrl,
    secret: env.payloadSecret,
    // Browsers and Capacitor WebViews may only call the API from these origins. Idempotency-Key is a custom header;
    // X-Debug-Now is ignored unless ALLOW_TIME_TRAVEL=1 (never in production).
    cors: { origins, headers: ['Idempotency-Key', 'X-Debug-Now'] },
    csrf: origins,
    email: createEmailAdapter(env),
    sharp,
    typescript: { outputFile: options.typesOutputFile },
    graphQL: { disable: true },
    db: postgresAdapter({
      pool: { connectionString: env.databaseUri },
      push: false,
      migrationDir: options.migrationDir,
    }),
  } satisfies Config
}
