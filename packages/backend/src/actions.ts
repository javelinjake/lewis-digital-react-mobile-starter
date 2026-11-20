import type { Endpoint, Payload, PayloadRequest, TypedUser } from 'payload'
import { APIError } from 'payload'
import { consumeRateLimit } from './rate-limit'
import { withTransaction } from './transactions'

/** A pending claim older than this belongs to a request that died. A retry may take over. */
const PENDING_TTL_MS = 60_000

type JsonBody = Record<string, unknown>

export interface ActionContext {
  req: PayloadRequest
  payload: Payload
  user: TypedUser
  body: JsonBody
}

export interface ActionResult {
  /** Defaults to 200. */
  status?: number
  body: unknown
}

export interface ActionOptions {
  /**
   * Path under `/api`, e.g. `/packs/open` or `/actions/duplicate-note`. The first segment must not be the slug of a
   * collection or global: Payload sends those paths to the collection's own endpoints, so the action would 404.
   * `createAppBackend` rejects such a path at startup.
   */
  path: string
  method?: 'post' | 'put' | 'patch' | 'delete'
  /** Require an `Idempotency-Key` header and replay the first result for a repeated key. Default true. */
  idempotent?: boolean
  rateLimit?: { limit: number, windowMs: number }
  /**
   * Runs inside one database transaction. Pass `ctx.req` to every Local API call so the writes commit or roll
   * back together, and the stored response is written in the same transaction.
   */
  handler: (ctx: ActionContext) => Promise<ActionResult>
}

function reply(body: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(body, { status, headers })
}

function errorReply(message: string, status: number, headers?: Record<string, string>) {
  return reply({ errors: [{ message }] }, status, headers)
}

async function readBody(req: PayloadRequest): Promise<JsonBody> {
  if (!req.json)
    return {}
  try {
    const parsed: unknown = await req.json()
    return parsed && typeof parsed === 'object' ? parsed as JsonBody : {}
  }
  catch {
    return {}
  }
}

interface StoredKey {
  id: string | number
  status: 'pending' | 'done'
  responseStatus?: number | null
  responseBody?: unknown
  createdAt: string
}

async function loadKey(payload: Payload, owner: string | number, route: string, key: string) {
  const found = await payload.find({
    collection: 'idempotency-keys',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ owner: { equals: owner } }, { route: { equals: route } }, { key: { equals: key } }] },
  })
  return found.docs[0] as unknown as StoredKey | undefined
}

/**
 * Claims the key by inserting a pending row (committed straight away, outside the action's transaction), so a
 * concurrent duplicate sees it. Returns the claim, or the existing row when someone else holds the key.
 */
async function claimKey(payload: Payload, owner: string | number, route: string, key: string, attempt = 0): Promise<{ claim: StoredKey } | { existing: StoredKey }> {
  try {
    const claim = await payload.create({
      collection: 'idempotency-keys',
      overrideAccess: true,
      data: { owner, route, key, status: 'pending' } as never,
    })
    return { claim: claim as unknown as StoredKey }
  }
  catch (error) {
    const existing = await loadKey(payload, owner, route, key)
    if (!existing)
      throw error

    const abandoned = existing.status === 'pending' && Date.now() - new Date(existing.createdAt).getTime() > PENDING_TTL_MS
    if (abandoned && attempt === 0) {
      await payload.delete({ collection: 'idempotency-keys', id: existing.id, overrideAccess: true })
      return claimKey(payload, owner, route, key, attempt + 1)
    }
    return { existing }
  }
}

/**
 * Builds a Payload endpoint for a server-authoritative action (open a pack, collect coins, grant a reward).
 * The server decides everything. The client only asks, and a retry with the same `Idempotency-Key` gets the
 * first answer back instead of a second grant.
 */
export function defineAction(options: ActionOptions): Endpoint {
  const idempotent = options.idempotent ?? true

  return {
    path: options.path,
    method: options.method ?? 'post',
    handler: async (req) => {
      const user = req.user
      if (!user)
        return errorReply('You must be signed in.', 401)

      const payload = req.payload
      const route = `${(options.method ?? 'post').toUpperCase()} ${options.path}`
      const body = await readBody(req)
      const ctx: ActionContext = { req, payload, user, body }

      let claim: StoredKey | undefined
      if (idempotent) {
        const key = req.headers.get('idempotency-key')?.trim()
        if (!key || key.length > 200)
          return errorReply('An Idempotency-Key header is required (up to 200 characters).', 400)

        const claimed = await claimKey(payload, user.id, route, key)
        if ('existing' in claimed) {
          const { existing } = claimed
          if (existing.status === 'done')
            return reply(existing.responseBody ?? {}, existing.responseStatus ?? 200, { 'Idempotent-Replay': 'true' })
          return errorReply('This request is already being processed.', 409, { 'Retry-After': '1' })
        }
        claim = claimed.claim
      }

      try {
        if (options.rateLimit) {
          const limited = await consumeRateLimit(payload, {
            key: `${route}:${user.id}`,
            limit: options.rateLimit.limit,
            windowMs: options.rateLimit.windowMs,
          })
          if (!limited.allowed)
            throw new APIError('Too many requests. Try again shortly.', 429)
        }

        const result = await withTransaction(req, async () => {
          const outcome = await options.handler(ctx)
          if (claim) {
            await payload.update({
              collection: 'idempotency-keys',
              id: claim.id,
              overrideAccess: true,
              req,
              data: { status: 'done', responseStatus: outcome.status ?? 200, responseBody: outcome.body as Record<string, unknown> },
            })
          }
          return outcome
        })

        return reply(result.body, result.status ?? 200)
      }
      catch (error) {
        // Nothing was applied, so release the key and let the client retry.
        if (claim)
          await payload.delete({ collection: 'idempotency-keys', id: claim.id, overrideAccess: true }).catch(() => undefined)
        throw error
      }
    },
  }
}

/** Deletes idempotency rows older than `olderThanMs` (default 7 days). Called from the cleanup cron. */
export async function pruneIdempotencyKeys(payload: Payload, olderThanMs = 7 * 24 * 60 * 60 * 1000) {
  const before = new Date(Date.now() - olderThanMs).toISOString()
  const result = await payload.delete({
    collection: 'idempotency-keys',
    overrideAccess: true,
    where: { createdAt: { less_than: before } },
  })
  return result.docs.length
}
