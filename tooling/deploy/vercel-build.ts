// Builds one client app for Vercel. Run from the app folder (Vercel's project root) as `pnpm run build:vercel`.
// It is the web PWA only: store builds (iOS and Android) are made with `build:native` and Capacitor, not here.
// The build checks the live-mode settings, works out the site URL, runs the app's production build,
// and sets robots.txt.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const appDir = process.cwd()
const repoRoot = resolve(appDir, '../../..')
const { name } = JSON.parse(readFileSync(resolve(appDir, 'package.json'), 'utf8')) as { name: string }
const env = process.env

function fail(message: string): never {
  console.error(`vercel-build: ${message}`)
  process.exit(1)
}

// A deployed build is always live and always the web target. A mock build must never reach a deployed URL.
if (env.VITE_DATA_MODE && env.VITE_DATA_MODE !== 'live')
  fail(`VITE_DATA_MODE is "${env.VITE_DATA_MODE}". Deployed builds must use "live" (or leave it unset).`)
env.VITE_DATA_MODE = 'live'
env.VITE_BUILD_TARGET = 'web'
delete env.VITE_ALLOW_MOCK_BUILD

// vercel.ts sends /api to the api app, so the browser stays on one origin and the session cookie is first-party.
if (!env.API_ORIGIN)
  fail('API_ORIGIN is not set. Set it to the api app\'s address (e.g. https://api.example.com) for Production and Preview in the Vercel project settings.')

// The web app calls /api on its own origin. An absolute address would turn that into a cross-site request.
if (env.VITE_API_URL) {
  console.warn('vercel-build: ignoring VITE_API_URL. The web build uses the same-origin /api rewrite.')
  delete env.VITE_API_URL
}

// The site URL is optional on Vercel: use the production domain, the branch URL, or the deployment URL.
const isProduction = env.VERCEL_ENV === 'production'
const host = isProduction
  ? env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL
  : env.VERCEL_BRANCH_URL ?? env.VERCEL_URL
if (!env.VITE_FRONTEND_URL && host)
  env.VITE_FRONTEND_URL = `https://${host}`
if (!env.VITE_FRONTEND_URL)
  fail('VITE_FRONTEND_URL is not set and no Vercel URL is available to derive it from.')

console.log(`vercel-build: ${name} (${env.VERCEL_ENV ?? 'local'}) frontend ${env.VITE_FRONTEND_URL} api ${env.API_ORIGIN}`)
execFileSync('pnpm', ['turbo', 'run', 'build', `--filter=${name}`], { cwd: repoRoot, env, stdio: 'inherit' })

// Only the production deployment may be indexed. Nothing under /api ever is.
const dist = resolve(appDir, 'dist')
mkdirSync(dist, { recursive: true })
writeFileSync(
  resolve(dist, 'robots.txt'),
  isProduction ? 'User-agent: *\nAllow: /\nDisallow: /api/\n' : 'User-agent: *\nDisallow: /\n',
)
