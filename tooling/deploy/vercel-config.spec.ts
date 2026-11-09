import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import process from 'node:process'

// Evaluates the real vercel.ts of the template app, the way Vercel does at build time.
const appDir = resolve(import.meta.dirname, '../../apps/template/app')

interface Rewrite { source: string, destination: string }
interface HeaderRule { source: string, headers: Array<{ key: string, value: string }> }
interface Config { rewrites: Rewrite[], headers: HeaderRule[], buildCommand: string }

function evaluate(env: Record<string, string>) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '-e', 'import("./vercel.ts").then(m => console.log(JSON.stringify(m.config)))'],
    { cwd: appDir, env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' },
  )
  return { ok: result.status === 0, config: result.status === 0 ? JSON.parse(result.stdout) as Config : undefined, error: result.stderr }
}

const headersFor = (config: Config, source: string) => config.headers.find(rule => rule.source === source)?.headers ?? []
const header = (config: Config, source: string, key: string) => headersFor(config, source).find(item => item.key === key)?.value

describe('vercel.ts', () => {
  const { config } = evaluate({ API_ORIGIN: 'https://api.example.com/' })

  it('forwards /api to the api app so the session cookie stays first-party', () => {
    assert.ok(config)
    assert.deepEqual(config.rewrites[0], { source: '/api/:path*', destination: 'https://api.example.com/api/:path*' })
  })

  it('puts the API rewrite before the single-page-app fallback', () => {
    assert.ok(config)
    const api = config.rewrites.findIndex(rewrite => rewrite.source.startsWith('/api/'))
    const fallback = config.rewrites.findIndex(rewrite => rewrite.destination === '/index.html')
    assert.ok(api >= 0 && fallback > api)
  })

  it('falls back to the app for screens, but not for files or the app-link files', () => {
    assert.ok(config)
    const fallback = new RegExp(`^${config.rewrites.find(rewrite => rewrite.destination === '/index.html')!.source}$`)
    for (const route of ['/', '/notes/3', '/login', '/reset-password'])
      assert.ok(fallback.test(route), `${route} should open the app`)
    for (const file of ['/assets/index-abc.js', '/sw.js', '/manifest.webmanifest', '/favicon.svg', '/.well-known/assetlinks.json', '/.well-known/apple-app-site-association'])
      assert.ok(!fallback.test(file), `${file} is a real file`)
  })

  it('caches hashed assets forever and revalidates what a new release replaces', () => {
    assert.ok(config)
    assert.match(header(config, '/assets/(.*)', 'Cache-Control') ?? '', /immutable/)
    for (const file of ['/index.html', '/sw.js', '/manifest.webmanifest'])
      assert.match(header(config, file, 'Cache-Control') ?? '', /must-revalidate/, `${file} must revalidate`)
    assert.equal(header(config, '/config.js', 'Cache-Control'), 'no-cache')
  })

  it('serves the iOS app-link file as JSON', () => {
    assert.ok(config)
    assert.equal(header(config, '/.well-known/apple-app-site-association', 'Content-Type'), 'application/json')
  })

  it('sets the baseline security headers and never opens CORS to everyone', () => {
    assert.ok(config)
    const all = headersFor(config, '/(.*)').map(item => item.key)
    for (const key of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy'])
      assert.ok(all.includes(key), `${key} is set`)
    const everything = config.headers.flatMap(rule => rule.headers.map(item => `${item.key}: ${item.value}`)).join('\n')
    assert.ok(!/access-control-allow-origin/i.test(everything))
  })

  it('refuses to build on Vercel without an API address', () => {
    const outcome = evaluate({ VERCEL: '1' })
    assert.equal(outcome.ok, false)
    assert.match(outcome.error, /API_ORIGIN is not set/)
  })

  it('builds through the vercel-build script', () => {
    assert.ok(config)
    assert.equal(config.buildCommand, 'pnpm run build:vercel')
  })
})
