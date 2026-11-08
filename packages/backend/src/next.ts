import type { NextConfig } from 'next'

/**
 * Response headers a cross-origin client (a Capacitor WebView) is allowed to read.
 * `set-auth-token` carries the session token after sign-in. Without this the native app never sees it.
 */
export const EXPOSED_HEADERS = ['set-auth-token', 'Idempotent-Replay', 'Retry-After']

/** Next config for an api app: Payload admin and REST only, no public pages. */
export function createApiNextConfig(): NextConfig {
  return {
    poweredByHeader: false,
    // Playwright and the Capacitor dev server open the dev server on 127.0.0.1.
    allowedDevOrigins: ['127.0.0.1'],
    transpilePackages: ['@ld/backend'],
    async headers() {
      return [
        {
          source: '/api/:path*',
          headers: [{ key: 'Access-Control-Expose-Headers', value: EXPOSED_HEADERS.join(', ') }],
        },
      ]
    },
  }
}
