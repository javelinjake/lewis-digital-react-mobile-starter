/**
 * Origins that may call the backend.
 *
 * - Web: the PWA origins from `APP_ORIGINS` (comma separated).
 * - Native: Capacitor serves the bundle from `capacitor://<hostname>` on iOS and `https://<hostname>` on Android.
 *   `config-capacitor` sets `server.hostname` from `app.meta.hostname`, and falls back to `localhost`.
 */
export interface AllowedOriginsInput {
  /** Comma separated list, usually `process.env.APP_ORIGINS`. */
  appOrigins?: string
  /** `app.meta.hostname`, the production hostname used for Universal and App Links. */
  hostname?: string
  /** Include the localhost web origins used by Vite and the Capacitor dev server. */
  development?: boolean
}

function clean(origin: string) {
  return origin.trim().replace(/\/+$/, '')
}

export function buildAllowedOrigins(input: AllowedOriginsInput = {}): string[] {
  const origins = new Set<string>()

  for (const origin of (input.appOrigins ?? '').split(',')) {
    if (clean(origin))
      origins.add(clean(origin))
  }

  const hostname = input.hostname?.trim() || 'localhost'
  origins.add(`capacitor://${hostname}`)
  origins.add(`https://${hostname}`)
  if (hostname !== 'localhost') {
    origins.add('capacitor://localhost')
    origins.add('https://localhost')
  }

  if (input.development) {
    origins.add('http://localhost:5173')
    origins.add('http://localhost:4173')
    origins.add('http://localhost:3001')
    origins.add('http://127.0.0.1:5173')
  }

  return [...origins]
}
