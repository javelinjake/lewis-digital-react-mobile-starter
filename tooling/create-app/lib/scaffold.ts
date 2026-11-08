import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type AppKind = 'app' | 'game'
export type WebTarget = 'pwa' | 'playtest' | 'none'

export interface ScaffoldOptions {
  name: string
  slug: string
  kind: AppKind
  web: WebTarget
  /** Reverse-DNS bundle id for production. dev/staging add suffixes. */
  appId: string
  hostname: string
  /** Splash and PWA theme colours. */
  themeColor: string
  backgroundColor: string
  orientation: 'portrait' | 'any'
  tablet: boolean
}

export interface ScaffoldResult {
  /** What was (or, in a dry run, would be) created, relative to the repo root. */
  created: string[]
  edited: string[]
}

const SKIP = /\/(node_modules|dist|test-results|\.turbo|\.next|\.data|ios|android|\.trapeze|dev-dist)(\/|$)|next-env\.d\.ts$|tsbuildinfo$|\.env(\.local)?$/

export function validateOptions(options: ScaffoldOptions) {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(options.slug))
    throw new Error(`The slug "${options.slug}" must be lower case letters, numbers and dashes, starting with a letter.`)
  if (['template', 'playground'].includes(options.slug))
    throw new Error(`"${options.slug}" is reserved.`)
  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(options.appId))
    throw new Error(`The bundle id "${options.appId}" must look like uk.co.lewisdigital.myapp.`)
  for (const colour of [options.themeColor, options.backgroundColor]) {
    if (!/^#[0-9a-f]{6}$/i.test(colour))
      throw new Error(`The colour "${colour}" must look like #1b1f3b.`)
  }
  if (!options.name.trim())
    throw new Error('The app needs a name.')
}

const quote = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`

export function appMetaSource(options: ScaffoldOptions) {
  return `/**
 * Single source of truth for identity shared by the web manifest, Capacitor config, native project configuration and
 * the api app (which reads the sign-in methods from here).
 */
export const appMeta = {
  name: ${quote(options.name)},
  shortName: ${quote(options.name.slice(0, 12))},
  description: ${quote(`${options.name} mobile app.`)},
  /** Reverse-DNS identifier used for the iOS bundle ID and Android application ID. */
  appId: ${quote(options.appId)},
  /** Production web origin, used for Universal Links / App Links. Fill in once the domain is known. */
  hostname: ${quote(options.hostname)},
  orientation: ${quote(options.orientation)},
  tablet: ${options.tablet},
  /** One entry per build environment (APP_ENV). Fill in each api address once it exists. */
  environments: {
    dev: { apiUrl: 'http://localhost:3001' },
    staging: { apiUrl: '' },
    prod: { apiUrl: '' },
  },
  themeColor: ${quote(options.themeColor)},
  backgroundColor: ${quote(options.backgroundColor)},
  /** Sign-in methods this app offers. Google needs Apple as well: the App Store requires it. */
  auth: {
    emailPassword: true,
    anonymous: true,
    apple: false,
    google: false,
  },
} as const
`
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function replaceInFile(path: string, from: string | RegExp, to: string) {
  if (!existsSync(path))
    return false
  const before = readFileSync(path, 'utf8')
  const after = before.replace(from, to)
  if (after === before)
    return false
  writeFileSync(path, after)
  return true
}

export function databaseName(slug: string) {
  return slug.replace(/-/g, '_')
}

/**
 * Creates `apps/<slug>/{app,api}` (and `core` for a game) from the template, registers the app, and adds its
 * databases. In a dry run nothing is written: it reports what would be.
 */
export function scaffold(repoRoot: string, options: ScaffoldOptions, { dryRun = true } = {}): ScaffoldResult {
  validateOptions(options)

  const target = join(repoRoot, 'apps', options.slug)
  if (existsSync(target))
    throw new Error(`apps/${options.slug} already exists.`)

  const database = databaseName(options.slug)
  const created = [`apps/${options.slug}/app`, `apps/${options.slug}/api`]
  const edited = ['tooling/apps/apps.config.json', 'tooling/cms/init-databases.sql']
  if (options.kind === 'game')
    created.push(`apps/${options.slug}/core`, `apps/${options.slug}/art`)

  if (dryRun)
    return { created, edited }

  const appDir = join(target, 'app')
  const apiDir = join(target, 'api')
  const copyOptions = { recursive: true, filter: (source: string) => !SKIP.test(source) }
  cpSync(join(repoRoot, 'apps/template/app'), appDir, copyOptions)
  cpSync(join(repoRoot, 'apps/template/api'), apiDir, copyOptions)

  // Identity
  const appPackage = readJson(join(appDir, 'package.json'))
  appPackage.name = `@ld/app-${options.slug}`
  appPackage.version = '0.1.0'
  writeJson(join(appDir, 'package.json'), appPackage)

  const apiPackage = readJson(join(apiDir, 'package.json'))
  apiPackage.name = `@ld/api-${options.slug}`
  apiPackage.version = '0.1.0'
  writeJson(join(apiDir, 'package.json'), apiPackage)

  writeFileSync(join(appDir, 'app.meta.ts'), appMetaSource(options))
  writeFileSync(join(appDir, 'src/config/app.config.ts'), `export const appConfig = {\n  name: ${quote(options.name)},\n  projectId: ${quote(options.slug)},\n  defaultRoute: '/home',\n  layout: 'tabs' as const,\n}\n`)
  replaceInFile(join(appDir, 'index.html'), '<title>Lewis Digital App</title>', `<title>${options.name.replace(/</g, '&lt;')}</title>`)
  for (const file of ['public/.well-known/apple-app-site-association', 'public/.well-known/assetlinks.json'])
    replaceInFile(join(appDir, file), /uk\.co\.lewisdigital\.template/g, options.appId)

  // The api gets its own database, and the playtest/web flags in the registry decide whether it deploys a client.
  replaceInFile(join(apiDir, 'payload.config.ts'), `CMS_LOCAL_DATABASE ??= 'template'`, `CMS_LOCAL_DATABASE ??= '${database}'`)
  replaceInFile(join(apiDir, 'vitest.integration.config.ts'), `?? 'template_test'`, `?? '${database}_test'`)

  if (options.kind === 'game') {
    const coreDir = join(target, 'core')
    mkdirSync(join(coreDir, 'src'), { recursive: true })
    mkdirSync(join(coreDir, 'tests'), { recursive: true })
    mkdirSync(join(target, 'art'), { recursive: true })
    writeJson(join(coreDir, 'package.json'), {
      name: `@ld/${options.slug}-core`,
      type: 'module',
      version: '0.1.0',
      private: true,
      exports: { '.': './src/index.ts' },
      scripts: {
        build: 'tsc --noEmit -p tsconfig.json',
        ts: 'tsc --noEmit -p tsconfig.json',
        'test:unit': 'vitest run',
        'architecture:check': 'bash ../../../tooling/architecture-check/architecture-check.sh .',
      },
      dependencies: { '@ld/utils': 'workspace:*' },
      devDependencies: { '@ld/config-typescript': 'workspace:*', typescript: 'catalog:', vitest: 'catalog:' },
    })
    writeJson(join(coreDir, 'tsconfig.json'), { extends: '../../../packages/config-typescript/backend.json', compilerOptions: { types: [] }, include: ['src/**/*.ts', 'tests/**/*.ts', 'vitest.config.ts'] })
    writeFileSync(join(coreDir, 'vitest.config.ts'), `import { defineConfig } from 'vitest/config'\n\nexport default defineConfig({ test: { environment: 'node', include: ['tests/**/*.spec.ts'] } })\n`)
    writeFileSync(join(coreDir, 'src/index.ts'), `/**\n * ${options.name} game rules. Pure TypeScript: no React, Capacitor or Payload, and no Math.random or Date.now().\n * The app uses it for previews and the api for outcomes, so the numbers always match.\n */\nexport const GAME_ID = ${quote(options.slug)}\n`)
    writeFileSync(join(coreDir, 'tests/smoke.spec.ts'), `import { expect, it } from 'vitest'\nimport { GAME_ID } from '../src'\n\nit('is wired up', () => {\n  expect(GAME_ID).toBe(${quote(options.slug)})\n})\n`)
    writeFileSync(join(target, 'art/README.md'), `# ${options.name} art\n\nSource art, sheets and audio for the game. Optimised copies go into \`../app/src/assets/game/\`.\n`)
  }

  // Registry
  const registryPath = join(repoRoot, 'tooling/apps/apps.config.json')
  const registry = readJson(registryPath)
  registry.apps.push({
    slug: options.slug,
    packageName: `@ld/app-${options.slug}`,
    path: `apps/${options.slug}/app`,
    api: { packageName: `@ld/api-${options.slug}`, path: `apps/${options.slug}/api` },
    ...(options.kind === 'game' ? { core: { packageName: `@ld/${options.slug}-core`, path: `apps/${options.slug}/core` } } : {}),
    web: options.web,
    budget: { initialJsKb: options.kind === 'game' ? 400 : 170 },
    deployable: false,
  })
  writeJson(registryPath, registry)

  // Databases
  const sqlPath = join(repoRoot, 'tooling/cms/init-databases.sql')
  mkdirSync(dirname(sqlPath), { recursive: true })
  const sql = existsSync(sqlPath) ? readFileSync(sqlPath, 'utf8') : ''
  writeFileSync(sqlPath, `${sql.replace(/\n*$/, '\n')}CREATE DATABASE ${database};\nCREATE DATABASE ${database}_test;\n`)

  return { created, edited }
}
