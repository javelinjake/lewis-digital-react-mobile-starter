import type { PayloadRequest } from 'payload'
import { resolveBackendEnv } from '@ld/backend'

/**
 * The time every game rule runs at: the server's clock, never the client's. With `ALLOW_TIME_TRAVEL=1` (tests and
 * playtest builds; the backend refuses to start with it in production) an `X-Debug-Now` header in epoch milliseconds
 * or ISO form overrides it, so a tester can skip a day without waiting.
 */
export function serverNow(req: PayloadRequest): number {
  const header = req.headers.get('x-debug-now')
  if (header && resolveBackendEnv().allowTimeTravel) {
    const value = /^\d+$/.test(header) ? Number(header) : Date.parse(header)
    if (Number.isFinite(value))
      return value
  }
  return Date.now()
}
