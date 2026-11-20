import type { Payload, PayloadRequest } from 'payload'

export interface RateLimitOptions {
  /** What is being limited, e.g. `packs:open:42`. Build it from the route and the user id. */
  key: string
  limit: number
  windowMs: number
}

/**
 * Records the attempt first, then counts attempts in the window including this one,
 * so concurrent requests cannot all pass a stale count.
 */
export async function consumeRateLimit(payload: Payload, options: RateLimitOptions, req?: PayloadRequest) {
  const since = new Date(Date.now() - options.windowMs).toISOString()

  await payload.create({ collection: 'action-throttles', overrideAccess: true, data: { key: options.key }, req })

  const attempts = await payload.count({
    collection: 'action-throttles',
    overrideAccess: true,
    req,
    where: { and: [{ key: { equals: options.key } }, { createdAt: { greater_than: since } }] },
  })

  return { allowed: attempts.totalDocs <= options.limit, attempts: attempts.totalDocs, limit: options.limit }
}

/** Deletes rate-limit rows older than `olderThanMs`. Called from the cleanup cron. */
export async function pruneRateLimits(payload: Payload, olderThanMs = 24 * 60 * 60 * 1000) {
  const before = new Date(Date.now() - olderThanMs).toISOString()
  const result = await payload.delete({
    collection: 'action-throttles',
    overrideAccess: true,
    where: { createdAt: { less_than: before } },
  })
  return result.docs.length
}
