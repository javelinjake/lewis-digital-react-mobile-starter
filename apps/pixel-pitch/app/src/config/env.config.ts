export type DataMode = 'mock' | 'live'

export interface AppRuntimeConfig {
  /** Empty on the web: the app calls `/api` on its own origin and the host forwards it. Required on native. */
  VITE_API_URL: string
  VITE_FRONTEND_URL: string
}

function pickValue(runtimeValue: string | undefined, buildValue: string | undefined): string {
  const runtime = runtimeValue?.trim()
  if (runtime)
    return runtime

  return buildValue?.trim() ?? ''
}

/**
 * Web builds can override the URLs at runtime via `/config.js`.
 * Native bundles only see build-time values. The data mode is never overridable at runtime.
 */
function readRuntimeConfig(): AppRuntimeConfig {
  const runtime = import.meta.env.DEV || import.meta.env.VITE_BUILD_TARGET === 'native'
    ? {}
    : (window.__APP_CONFIG__ ?? {})

  return {
    VITE_API_URL: pickValue(runtime.VITE_API_URL, import.meta.env.VITE_API_URL).replace(/\/+$/, ''),
    VITE_FRONTEND_URL: pickValue(runtime.VITE_FRONTEND_URL, import.meta.env.VITE_FRONTEND_URL).replace(/\/+$/, ''),
  }
}

/**
 * `mock` runs the app against an in-memory backend (development, tests, Lighthouse). `live` talks to the api app.
 * A release build must be `live`: `config-vite` refuses to build otherwise unless `VITE_ALLOW_MOCK_BUILD=1`.
 */
export function getDataMode(): DataMode {
  const raw = import.meta.env.VITE_DATA_MODE?.trim()

  if (!raw) {
    if (import.meta.env.DEV)
      return 'mock'
    throw new Error('VITE_DATA_MODE is not set. Use "live" for a real build.')
  }
  if (raw !== 'mock' && raw !== 'live')
    throw new Error(`VITE_DATA_MODE must be "mock" or "live", not "${raw}".`)
  if (raw === 'mock' && import.meta.env.PROD && import.meta.env.VITE_ALLOW_MOCK_BUILD !== '1')
    throw new Error('A production build cannot use mock data.')

  return raw
}

export function validateEnv(): AppRuntimeConfig {
  const config = readRuntimeConfig()
  const dataMode = getDataMode()

  // https, except an api on this machine (the simulator reaches the Mac at localhost), for local native testing.
  const local = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(config.VITE_API_URL)
  if (dataMode === 'live' && import.meta.env.VITE_BUILD_TARGET === 'native' && !/^https:\/\//.test(config.VITE_API_URL) && !local) {
    throw new Error('Native builds need VITE_API_URL set to the https address of the api app (or http://localhost for the simulator). See .env.local.example.')
  }

  return config
}

let cachedConfig: AppRuntimeConfig | null = null

export function getEnvConfig(): AppRuntimeConfig {
  if (!cachedConfig)
    cachedConfig = validateEnv()

  return cachedConfig
}

/** The public origin of the web app. Used for links in emails, which open the app through a Universal or App Link. */
export function getFrontendOrigin() {
  return getEnvConfig().VITE_FRONTEND_URL || window.location.origin
}
