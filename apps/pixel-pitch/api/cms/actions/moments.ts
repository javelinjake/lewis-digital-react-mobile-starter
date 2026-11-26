import type { AnyTaps } from '@ld/pixel-pitch-core'
import { defineAction } from '@ld/backend'
import { finishChance, skipChance, startChance } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'
import { flowContext, mutateClub } from '../game/mutate-club'

// Match moments: a Big Chance banked from a missed match, or the live moment of a watched one. Started (the server
// issues a ticket for one round of the arcade game, at the club's league), finished (the server replays the taps)
// or let go. A scored moment rewrites the stored match.

const limits = { rateLimit: { limit: 60, windowMs: 60_000 } }

function fixtureNo(body: Record<string, unknown>): number {
  const value = body.fixtureNo
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    throw new APIError('Send fixtureNo: the league match the moment is for.', 400)
  return value
}

export const startChanceAction = defineAction({
  path: '/game/chance/start',
  ...limits,
  handler: async (ctx) => {
    const no = fixtureNo(ctx.body)
    return { body: await mutateClub(ctx, input => startChance(flowContext(input), no)) }
  },
})

export const finishChanceAction = defineAction({
  path: '/game/chance/finish',
  ...limits,
  handler: async (ctx) => {
    const taps = ctx.body.taps
    if (!Array.isArray(taps))
      throw new APIError('Send taps: what the game recorded.', 400)
    return {
      body: await mutateClub(ctx, (input) => {
        const result = finishChance(flowContext(input), taps as AnyTaps)
        return { ...result, fixtureChanges: result.extra?.change ? [result.extra.change] : [] }
      }),
    }
  },
})

export const skipChanceAction = defineAction({
  path: '/game/chance/skip',
  ...limits,
  handler: async (ctx) => {
    const no = fixtureNo(ctx.body)
    return { body: await mutateClub(ctx, input => skipChance(flowContext(input), no)) }
  },
})

export const momentActions = [startChanceAction, finishChanceAction, skipChanceAction]
