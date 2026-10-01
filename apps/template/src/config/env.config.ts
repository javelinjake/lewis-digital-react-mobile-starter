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
    : (window.__APP_CONFIG__ ?? {})

  return {
    VITE_DIRECTUS_URL: pickValue(runtime.VITE_DIRECTUS_URL, import.meta.env.VITE_DIRECTUS_URL),
    VITE_FRONTEND_URL: pickValue(runtime.VITE_FRONTEND_URL, import.meta.env.VITE_FRONTEND_URL),
  }
}

export function validateEnv(): AppRuntimeConfig {
  const config = readRuntimeConfig()
  const missing = REQUIRED_KEYS.filter(key => !config[key]?.trim())

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. `
      + 'Copy .env.local.example to .env.local and set values before starting the app.',
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
