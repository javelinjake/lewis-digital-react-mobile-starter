import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { scaffold, type ScaffoldOptions } from './scaffold'

const realRoot = resolve(import.meta.dirname, '../../..')
const roots: string[] = []

/** A throwaway repo with just what the scaffold reads, so tests never touch the real one. */
function fakeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'create-app-'))
  roots.push(root)
  const skip = (source: string) => !/\/(node_modules|dist|test-results|\.next|\.data|ios|android)(\/|$)/.test(source)
  cpSync(join(realRoot, 'apps/template'), join(root, 'apps/template'), { recursive: true, filter: skip })
  cpSync(join(realRoot, 'tooling/apps'), join(root, 'tooling/apps'), { recursive: true })
  cpSync(join(realRoot, 'tooling/cms/init-databases.sql'), join(root, 'tooling/cms/init-databases.sql'), { recursive: true })
  return root
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

const base: ScaffoldOptions = {
  name: 'Pixel Pitch',
  slug: 'pixel-pitch',
  kind: 'game',
  web: 'playtest',
  appId: 'uk.co.lewisdigital.pixelpitch',
  hostname: 'pixelpitch.app',
  themeColor: '#ffd23f',
  backgroundColor: '#1b1f3b',
  orientation: 'portrait',
  tablet: false,
}

const read = (root: string, path: string) => readFileSync(join(root, path), 'utf8')
const json = (root: string, path: string) => JSON.parse(read(root, path))

describe('scaffold', () => {
  it('writes nothing in a dry run, and reports what it would make', () => {
    const root = fakeRepo()
    const result = scaffold(root, base)
    assert.deepEqual(result.created, ['apps/pixel-pitch/app', 'apps/pixel-pitch/api', 'apps/pixel-pitch/core', 'apps/pixel-pitch/art'])
    assert.equal(existsSync(join(root, 'apps/pixel-pitch')), false)
    assert.equal(json(root, 'tooling/apps/apps.config.json').apps.length, 1)
  })

  it('names the packages and writes the identity files', () => {
    const root = fakeRepo()
    scaffold(root, base, { dryRun: false })

    assert.equal(json(root, 'apps/pixel-pitch/app/package.json').name, '@ld/app-pixel-pitch')
    assert.equal(json(root, 'apps/pixel-pitch/api/package.json').name, '@ld/api-pixel-pitch')
    const meta = read(root, 'apps/pixel-pitch/app/app.meta.ts')
    assert.match(meta, /name: 'Pixel Pitch'/)
    assert.match(meta, /appId: 'uk\.co\.lewisdigital\.pixelpitch'/)
    assert.match(meta, /orientation: 'portrait'/)
    assert.match(meta, /tablet: false/)
    assert.match(meta, /themeColor: '#ffd23f'/)
    assert.match(read(root, 'apps/pixel-pitch/app/src/config/app.config.ts'), /projectId: 'pixel-pitch'/)
    assert.match(read(root, 'apps/pixel-pitch/app/index.html'), /<title>Pixel Pitch<\/title>/)
    assert.match(read(root, 'apps/pixel-pitch/app/public/.well-known/apple-app-site-association'), /uk\.co\.lewisdigital\.pixelpitch/)
  })

  it('gives the api its own database, so apps never share data', () => {
    const root = fakeRepo()
    scaffold(root, base, { dryRun: false })
    assert.match(read(root, 'apps/pixel-pitch/api/payload.config.ts'), /CMS_LOCAL_DATABASE \?\?= 'pixel_pitch'/)
    assert.match(read(root, 'apps/pixel-pitch/api/vitest.integration.config.ts'), /'pixel_pitch_test'/)
    const sql = read(root, 'tooling/cms/init-databases.sql')
    assert.match(sql, /CREATE DATABASE pixel_pitch;/)
    assert.match(sql, /CREATE DATABASE pixel_pitch_test;/)
    assert.doesNotMatch(read(root, 'apps/pixel-pitch/api/payload.config.ts'), /'template'/)
  })

  it('registers the app with its api, core, web target and bundle budget', () => {
    const root = fakeRepo()
    scaffold(root, base, { dryRun: false })
    const entry = json(root, 'tooling/apps/apps.config.json').apps.find((app: { slug: string }) => app.slug === 'pixel-pitch')
    assert.deepEqual(entry, {
      slug: 'pixel-pitch',
      packageName: '@ld/app-pixel-pitch',
      path: 'apps/pixel-pitch/app',
      api: { packageName: '@ld/api-pixel-pitch', path: 'apps/pixel-pitch/api' },
      core: { packageName: '@ld/pixel-pitch-core', path: 'apps/pixel-pitch/core' },
      web: 'playtest',
      budget: { initialJsKb: 400 },
      deployable: false,
    })
  })

  it('adds a pure core package and an art folder for a game, and neither for an app', () => {
    const game = fakeRepo()
    scaffold(game, base, { dryRun: false })
    assert.equal(json(game, 'apps/pixel-pitch/core/package.json').name, '@ld/pixel-pitch-core')
    assert.ok(existsSync(join(game, 'apps/pixel-pitch/core/tests/smoke.spec.ts')))
    assert.ok(existsSync(join(game, 'apps/pixel-pitch/art/README.md')))

    const app = fakeRepo()
    scaffold(app, { ...base, kind: 'app', web: 'pwa', slug: 'notes-app', orientation: 'any', tablet: true }, { dryRun: false })
    assert.equal(existsSync(join(app, 'apps/notes-app/core')), false)
    assert.equal(json(app, 'tooling/apps/apps.config.json').apps.find((entry: { slug: string }) => entry.slug === 'notes-app').budget.initialJsKb, 170)
  })

  it('leaves out build output, native projects, secrets and the template\'s own database', () => {
    const root = fakeRepo()
    scaffold(root, base, { dryRun: false })
    for (const path of ['node_modules', 'dist', 'ios', 'android', '.env', '.env.local', 'test-results'])
      assert.equal(existsSync(join(root, 'apps/pixel-pitch/app', path)), false, `${path} was copied`)
    assert.equal(existsSync(join(root, 'apps/pixel-pitch/api/next-env.d.ts')), false)
    assert.equal(existsSync(join(root, 'apps/pixel-pitch/api/.next')), false)
  })

  it('refuses a clash, a reserved name, and bad input', () => {
    const root = fakeRepo()
    scaffold(root, base, { dryRun: false })
    assert.throws(() => scaffold(root, base), /already exists/)
    assert.throws(() => scaffold(root, { ...base, slug: 'template' }), /reserved/)
    assert.throws(() => scaffold(root, { ...base, slug: 'Bad Slug' }), /slug/)
    assert.throws(() => scaffold(root, { ...base, appId: 'nodots' }), /bundle id/)
    assert.throws(() => scaffold(root, { ...base, themeColor: 'yellow' }), /colour/)
  })

  it('escapes quotes in the display name instead of breaking the file', () => {
    const root = fakeRepo()
    scaffold(root, { ...base, name: `Ada's "Club"` }, { dryRun: false })
    assert.match(read(root, 'apps/pixel-pitch/app/app.meta.ts'), /name: 'Ada\\'s "Club"'/)
  })
})
