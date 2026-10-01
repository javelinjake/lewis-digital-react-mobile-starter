export interface AppRuntimeConfig {
  VITE_DIRECTUS_URL: string
  VITE_FRONTEND_URL: string
}

const REQUIRED_KEYS: (keyof AppRuntimeConfig)[] = [
  'VITE_DIRECTUS_URL',
  'VITE_FRONTEND_URL',
]

function pickValue(runtimeValue: string | undefined, buildValue: string | undefined): string {
  const runtime = runtimeValue?.trim()
  if (runtime)
    return runtime

  return buildValue?.trim() ?? ''
}

/**
 * Web builds can override values at runtime via `/config.js`.
 * Native bundles only see build-time values.
 */
function readRuntimeConfig(): AppRuntimeConfig {
  const runtime = import.meta.env.DEV || import.meta.env.VITE_BUILD_TARGET === 'native'
    ? {}
    : (typeof window !== 'undefined' ? window.__APP_CONFIG__ ?? {} : {})

  const frontendFallback = typeof window !== 'undefined' ? window.location.origin : ''

  return {
    VITE_DIRECTUS_URL: pickValue(runtime.VITE_DIRECTUS_URL, import.meta.env.VITE_DIRECTUS_URL),
    VITE_FRONTEND_URL: pickValue(runtime.VITE_FRONTEND_URL, import.meta.env.VITE_FRONTEND_URL) || frontendFallback,
  }
}

export function validateEnv(): AppRuntimeConfig {
  const config = readRuntimeConfig()
  const missing = REQUIRED_KEYS.filter(key => !config[key]?.trim())

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. `
      + 'Copy .env.example to .env and set values before starting the app.',
    )
  }

  return config
}

let cachedConfig: AppRuntimeConfig | null = null

export function getEnvConfig(): AppRuntimeConfig {
  if (!cachedConfig)
    cachedConfig = validateEnv()

  return cachedConfig
}
