import type { Endpoint, Payload } from 'payload'
import { pruneIdempotencyKeys } from '../actions'
import { pruneRateLimits } from '../rate-limit'
import { bearerValue, secretMatches } from '../secret'

export interface CronOptions {
  /** `CRON_SECRET`. Vercel Cron sends it as `Authorization: Bearer <secret>`. */
  secret: string | undefined
  /** App-specific housekeeping, e.g. expiring old fixtures. Returns a count for the response. */
  extra?: (payload: Payload) => Promise<Record<string, number>> | Record<string, number>
}

/** `GET /api/cron/cleanup`: prunes idempotency keys and rate-limit rows. Wired to a daily Vercel cron. */
export function createCleanupEndpoint(options: CronOptions): Endpoint {
  return {
    path: '/cron/cleanup',
    method: 'get',
    handler: async (req) => {
      if (!options.secret)
        return Response.json({ errors: [{ message: 'Cron is not configured.' }] }, { status: 503 })
      if (!secretMatches(bearerValue(req.headers.get('authorization')), options.secret))
        return Response.json({ errors: [{ message: 'Unauthorized.' }] }, { status: 401 })

      const payload = req.payload
      const removed = {
        idempotencyKeys: await pruneIdempotencyKeys(payload),
        rateLimits: await pruneRateLimits(payload),
        ...await options.extra?.(payload),
      }
      return Response.json({ ok: true, removed })
    },
  }
}
