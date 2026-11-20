import type { Endpoint, Payload, PayloadRequest, TypedUser } from 'payload'
import { isPayloadId, toPayloadId } from '../loose'
import { bearerValue, secretMatches } from '../secret'
import { withTransaction } from '../transactions'

export interface RevenueCatEvent {
  id: string
  type: string
  app_user_id: string
  product_id?: string
  entitlement_ids?: string[] | null
  entitlement_id?: string | null
  expiration_at_ms?: number | null
  store?: string
  [key: string]: unknown
}

export interface PurchaseEventContext {
  payload: Payload
  /** Pass to every Local API call so the app's grants share the webhook's transaction. */
  req: PayloadRequest
  user: TypedUser
  event: RevenueCatEvent
  entitlements: string[]
}

export interface PurchaseOptions {
  /** `REVENUECAT_WEBHOOK_SECRET`. Set the same value as the webhook's Authorization header in RevenueCat. */
  secret: string | undefined
  /** App-specific grants, e.g. credit gems for a consumable. Runs once per event, inside the transaction. */
  onEvent?: (context: PurchaseEventContext) => Promise<void> | void
}

const GRANTING = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE'])
const REVOKING = new Set(['EXPIRATION'])

function parseEvent(body: unknown): RevenueCatEvent | undefined {
  const event = (body as { event?: unknown } | null)?.event as Partial<RevenueCatEvent> | undefined
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string' || typeof event.app_user_id !== 'string')
    return undefined
  return event as RevenueCatEvent
}

/** The RevenueCat app user id is the Payload user id as a string. RevenueCat's anonymous ids are not users. */
function userIdFrom(payload: Payload, appUserId: string) {
  return !appUserId.startsWith('$RCAnonymousID') && isPayloadId(payload, appUserId) ? toPayloadId(payload, appUserId) : undefined
}

/**
 * `POST /api/purchases/revenuecat`. Authenticated by a shared secret, applied exactly once per event id, and
 * atomic: the event record, the entitlement changes and the app's own grants commit together or not at all, so
 * RevenueCat's retries after a failure are safe.
 */
export function createRevenueCatEndpoint(options: PurchaseOptions): Endpoint {
  return {
    path: '/purchases/revenuecat',
    method: 'post',
    handler: async (req) => {
      if (!options.secret)
        return Response.json({ errors: [{ message: 'Purchases are not configured.' }] }, { status: 503 })
      if (!secretMatches(bearerValue(req.headers.get('authorization')), options.secret))
        return Response.json({ errors: [{ message: 'Unauthorized.' }] }, { status: 401 })

      const event = parseEvent(await req.json!().catch(() => undefined))
      if (!event)
        return Response.json({ errors: [{ message: 'Unrecognised event.' }] }, { status: 400 })

      const payload = req.payload
      const seen = await payload.count({ collection: 'purchase-events', where: { eventId: { equals: event.id } }, overrideAccess: true })
      if (seen.totalDocs > 0)
        return Response.json({ ok: true, duplicate: true })

      const userId = userIdFrom(payload, event.app_user_id)
      const user = userId === undefined
        ? undefined
        : await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true }).catch(() => undefined)

      const entitlements = event.entitlement_ids?.length ? event.entitlement_ids : event.entitlement_id ? [event.entitlement_id] : []

      await withTransaction(req, async () => {
        await payload.create({
          collection: 'purchase-events',
          overrideAccess: true,
          req,
          data: { eventId: event.id, type: event.type, appUserId: event.app_user_id, result: user ? 'applied' : 'ignored', payload: event as Record<string, unknown> },
        })

        if (!user)
          return

        const active = GRANTING.has(event.type) ? true : REVOKING.has(event.type) ? false : undefined
        if (active !== undefined) {
          for (const entitlement of entitlements)
            await upsertEntitlement(payload, req, user.id, entitlement, event, active)
        }

        await options.onEvent?.({ payload, req, user: user as TypedUser, event, entitlements })
      })

      return Response.json({ ok: true })
    },
  }
}

async function upsertEntitlement(payload: Payload, req: PayloadRequest, owner: string | number, entitlement: string, event: RevenueCatEvent, active: boolean) {
  const data = {
    owner,
    entitlement,
    active,
    expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    productId: event.product_id ?? null,
    store: event.store ?? null,
    lastEventId: event.id,
  }
  const existing = await payload.find({
    collection: 'entitlements',
    where: { and: [{ owner: { equals: owner } }, { entitlement: { equals: entitlement } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (existing.docs[0])
    await payload.update({ collection: 'entitlements', id: existing.docs[0].id, data: data as never, overrideAccess: true, req })
  else
    await payload.create({ collection: 'entitlements', data: data as never, overrideAccess: true, req })
}
