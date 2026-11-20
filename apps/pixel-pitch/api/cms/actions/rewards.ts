import type { PassTrack } from '@ld/pixel-pitch-core'
import { defineAction } from '@ld/backend'
import { claimAlbumSet, claimCalendar, claimFreePack, claimGoal, claimPassTier } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'
import { flowContext, mutateClub } from '../game/mutate-club'

// Daily goals, the free pack, the login calendar, the League Pass and the album. Progress is counted by the server
// as things happen (a match won, a pack opened); these only collect what is owed.

const limits = { rateLimit: { limit: 60, windowMs: 60_000 } }

export const claimGoalAction = defineAction({
  path: '/game/goals/claim',
  ...limits,
  handler: async (ctx) => {
    const goalId = ctx.body.goalId
    if (typeof goalId !== 'string')
      throw new APIError('Send goalId.', 400)
    return { body: await mutateClub(ctx, input => claimGoal(flowContext(input), goalId)) }
  },
})

export const claimFreePackAction = defineAction({
  path: '/game/goals/free-pack',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => claimFreePack(flowContext(input))) }),
})

export const claimCalendarAction = defineAction({
  path: '/game/calendar/claim',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => claimCalendar(flowContext(input))) }),
})

export const claimPassTierAction = defineAction({
  path: '/game/pass/claim',
  ...limits,
  handler: async (ctx) => {
    const { track, tier } = ctx.body
    if (typeof track !== 'string' || typeof tier !== 'number')
      throw new APIError('Send track ("free" or "premium") and tier.', 400)
    return { body: await mutateClub(ctx, input => claimPassTier(flowContext(input), track as PassTrack, tier)) }
  },
})

export const claimAlbumSetAction = defineAction({
  path: '/game/album/claim',
  ...limits,
  handler: async (ctx) => {
    const setId = ctx.body.setId
    if (typeof setId !== 'string')
      throw new APIError('Send setId.', 400)
    return { body: await mutateClub(ctx, input => claimAlbumSet(flowContext(input), setId)) }
  },
})

export const rewardActions = [claimGoalAction, claimFreePackAction, claimCalendarAction, claimPassTierAction, claimAlbumSetAction]
