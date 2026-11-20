import type { VercelConfig } from '@vercel/config/v1'
import process from 'node:process'

/**
 * Vercel project settings for the web PWA, evaluated when the project builds.
 *
 * `/api` is forwarded to the api app, so the browser only ever talks to its own origin and the session cookie is
 * first-party (no CORS, no third-party cookie blocking). Set `API_ORIGIN` per environment in the Vercel project:
 * the production API for Production, a preview API (or the production one) for Preview.
 */
const apiOrigin = (process.env.API_ORIGIN ?? '').replace(/\/+$/, '')

if (process.env.VERCEL && !apiOrigin)
  throw new Error('API_ORIGIN is not set. Set it to the api app\'s address in the Vercel project settings.')

const revalidate = 'public, max-age=0, must-revalidate'

export const config: VercelConfig = {
  framework: 'vite',
  installCommand: 'cd ../../.. && pnpm install --frozen-lockfile',
  buildCommand: 'pnpm run build:vercel',
  outputDirectory: 'dist',
  rewrites: [
    // Order matters: the API first, then every other path that is not a file falls back to the app.
    { source: '/api/:path*', destination: `${apiOrigin || 'http://localhost:3001'}/api/:path*` },
    { source: '/((?!assets/|\\.well-known/|.*\\..*).*)', destination: '/index.html' },
  ],
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
        { key: 'Content-Security-Policy', value: 'frame-ancestors \'none\'' },
      ],
    },
    // Hashed build output never changes under the same name.
    { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    // These must be re-checked on every visit, or a new release would not reach installed apps.
    { source: '/', headers: [{ key: 'Cache-Control', value: revalidate }] },
    { source: '/index.html', headers: [{ key: 'Cache-Control', value: revalidate }] },
    { source: '/sw.js', headers: [{ key: 'Cache-Control', value: revalidate }, { key: 'Service-Worker-Allowed', value: '/' }] },
    { source: '/manifest.webmanifest', headers: [{ key: 'Cache-Control', value: revalidate }] },
    { source: '/config.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    // iOS fetches this to verify Universal Links. It has no extension, so say what it is.
    {
      source: '/.well-known/apple-app-site-association',
      headers: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Cache-Control', value: 'public, max-age=3600' }],
    },
    { source: '/.well-known/assetlinks.json', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
  ],
}
