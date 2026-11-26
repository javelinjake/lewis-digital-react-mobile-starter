import type { ActionContext, PurchaseEventContext } from '@ld/backend'
import { defineAction } from '@ld/backend'
import { applyPurchase, buyBenchSlots, buyKit, changeIdentity, chooseSigning, refillEnergy, retryWarmup } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'
import { findClub, flowContext, identityOf, mutateClub } from '../game/mutate-club'

// What gems buy, and the grant for what money buys. Money never reaches these actions: a store purchase is paid
// through the RevenueCat webhook (`grantPurchase` below), after the store has taken the money. Gems never buy a
// random pack.

const limits = { rateLimit: { limit: 30, windowMs: 60_000 } }

export const refillEnergyAction = defineAction({
  path: '/game/shop/energy',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => refillEnergy(flowContext(input))) }),
})

export const benchSlotsAction = defineAction({
  path: '/game/shop/bench',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => buyBenchSlots(flowContext(input))) }),
})

export const retryWarmupAction = defineAction({
  path: '/game/shop/warmup',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => retryWarmup(flowContext(input))) }),
})

export const buyKitAction = defineAction({
  path: '/game/shop/kit',
  ...limits,
  handler: async (ctx) => {
    const kitId = ctx.body.kitId
    if (typeof kitId !== 'string')
      throw new APIError('Send kitId.', 400)
    return {
      body: await mutateClub(ctx, (input) => {
        const result = buyKit(flowContext(input), kitId, identityOf(input.club))
        return { ...result, identity: result.extra!.identity }
      }),
    }
  },
})

/** Changes the kit and/or crest. */
export const identityAction = defineAction({
  path: '/game/identity',
  ...limits,
  handler: async (ctx) => {
    const { kitId, crest } = ctx.body
    if ((kitId !== undefined && typeof kitId !== 'string') || (crest !== undefined && typeof crest !== 'number') || (kitId === undefined && crest === undefined))
      throw new APIError('Send kitId and/or crest.', 400)
    return {
      body: await mutateClub(ctx, (input) => {
        const result = changeIdentity(flowContext(input), { kitId, crest }, identityOf(input.club))
        return { ...result, identity: result.extra!.identity }
      }),
    }
  },
})

/** Uses a Star Signing on one of the three offered players. */
export const chooseSigningAction = defineAction({
  path: '/game/signing',
  ...limits,
  handler: async (ctx) => {
    const playerId = ctx.body.playerId
    if (typeof playerId !== 'string')
      throw new APIError('Send playerId.', 400)
    return { body: await mutateClub(ctx, input => chooseSigning(flowContext(input), playerId)) }
  },
})

export const shopActions = [refillEnergyAction, benchSlotsAction, retryWarmupAction, buyKitAction, identityAction, chooseSigningAction]

/** Event types that mean the store has just been paid for a product. Every product is a one-off purchase. */
const PAID = new Set(['NON_RENEWING_PURCHASE', 'INITIAL_PURCHASE'])

/**
 * The RevenueCat webhook's hook: pays a store purchase into the buyer's club. It runs once per event, inside the
 * webhook's transaction, so a retried event is never paid twice and a failure pays nothing. A product the rules do
 * not know, or a buyer with no club, is logged and left: the event is recorded, and failing would only make
 * RevenueCat retry something that cannot succeed.
 */
export async function grantPurchase({ payload, req, user, event }: PurchaseEventContext) {
  if (!PAID.has(event.type) || !event.product_id)
    return
  const productId = event.product_id
  const ctx: ActionContext = { payload, req, user: { ...user, collection: 'users' }, body: {} }
  if (!await findClub(ctx)) {
    payload.logger.warn({ msg: 'Purchase for a user with no club', eventId: event.id, productId })
    return
  }
  await mutateClub(ctx, (input) => {
    const result = applyPurchase(flowContext(input), productId)
    if (!result)
      payload.logger.warn({ msg: 'Purchase of an unknown product', eventId: event.id, productId })
    return result ?? { state: input.state }
  })
}
