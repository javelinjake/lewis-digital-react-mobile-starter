import { defineAction } from '@ld/backend'
import { buyKit, mayWearKit } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'
import { loadGame } from '../game/load'
import { findClub, flowContext, lockClub, mutateClub, readState } from '../game/mutate-club'

// The shop: gems for looks, never for power. A premium kit is bought once and can then be worn; any club can wear a
// free kit. Nothing here touches matches, packs, the daily challenge or a leaderboard.

const limits = { rateLimit: { limit: 30, windowMs: 60_000 } }
const HEX = /^#[0-9a-f]{6}$/i

export const buyKitAction = defineAction({
  path: '/game/shop/kit',
  ...limits,
  handler: async (ctx) => {
    const kitId = ctx.body.kitId
    if (typeof kitId !== 'string')
      throw new APIError('Send kitId.', 400)
    return { body: await mutateClub(ctx, input => buyKit(flowContext(input), kitId)) }
  },
})

/** Changes the club's kit to a free one or a premium one it owns. */
export const wearKitAction = defineAction({
  path: '/game/kit',
  ...limits,
  handler: async (ctx) => {
    const { kitPrimary, kitSecondary } = ctx.body
    if (typeof kitPrimary !== 'string' || typeof kitSecondary !== 'string' || !HEX.test(kitPrimary) || !HEX.test(kitSecondary))
      throw new APIError('Kit colours are #rrggbb.', 400, { code: 'kit' }, true)
    const game = await loadGame(ctx.payload)
    await lockClub(ctx)
    const club = await findClub(ctx)
    if (!club)
      throw new APIError('Create your club first.', 404, { code: 'no-club' }, true)
    if (!mayWearKit(readState(club, game.config), kitPrimary, kitSecondary, game.config))
      throw new APIError('That kit is not yours to wear. Buy it in the shop first.', 400, { code: 'not-owned' }, true)
    await ctx.payload.update({ collection: 'clubs', id: club.id, data: { kitPrimary: kitPrimary.toLowerCase(), kitSecondary: kitSecondary.toLowerCase() }, depth: 0, overrideAccess: true, req: ctx.req })
    return { body: await mutateClub(ctx, input => ({ state: input.state })) }
  },
})

export const shopActions = [buyKitAction, wearKitAction]
