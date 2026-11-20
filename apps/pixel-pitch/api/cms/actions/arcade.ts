import { defineAction } from '@ld/backend'
import { collectStadium, collectTray, finishPlay, finishWarmup, startPlay, startWarmup, upgradeStadium } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'
import { flowContext, mutateClub } from '../game/mutate-club'

// The stadium, the arcade and the warm-up kick. A game is started (the server issues a ticket with a seed and the
// time) and finished (the phone sends its taps; the server replays them with that seed and checks the clock), so a
// phone cannot send a score of its own.

const limits = { rateLimit: { limit: 60, windowMs: 60_000 } }

function cabinetOf(body: Record<string, unknown>) {
  if (body.cabinet !== 'kick' && body.cabinet !== 'keepy')
    throw new APIError('Send cabinet: "kick" or "keepy".', 400)
  return body.cabinet
}

export const collectStadiumAction = defineAction({
  path: '/game/stadium/collect',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => collectStadium(flowContext(input))) }),
})

export const upgradeStadiumAction = defineAction({
  path: '/game/stadium/upgrade',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => upgradeStadium(flowContext(input))) }),
})

export const collectTrayAction = defineAction({
  path: '/game/arcade/collect',
  ...limits,
  handler: async (ctx) => {
    const cabinet = cabinetOf(ctx.body)
    return { body: await mutateClub(ctx, input => collectTray(flowContext(input), cabinet)) }
  },
})

export const startPlayAction = defineAction({
  path: '/game/arcade/start',
  ...limits,
  handler: async (ctx) => {
    const cabinet = cabinetOf(ctx.body)
    return { body: await mutateClub(ctx, input => startPlay(flowContext(input), cabinet, ctx.body.paid === true)) }
  },
})

export const finishPlayAction = defineAction({
  path: '/game/arcade/finish',
  ...limits,
  handler: async (ctx) => {
    const cabinet = cabinetOf(ctx.body)
    const taps = ctx.body.taps
    if (!Array.isArray(taps))
      throw new APIError('Send taps: the numbers the game recorded.', 400)
    return { body: await mutateClub(ctx, input => finishPlay(flowContext(input), cabinet, taps as number[])) }
  },
})

export const startWarmupAction = defineAction({
  path: '/game/warmup/start',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => startWarmup(flowContext(input))) }),
})

export const finishWarmupAction = defineAction({
  path: '/game/warmup/finish',
  ...limits,
  handler: async (ctx) => {
    const tapMs = ctx.body.tapMs
    if (typeof tapMs !== 'number')
      throw new APIError('Send tapMs: when the player tapped.', 400)
    return { body: await mutateClub(ctx, input => finishWarmup(flowContext(input), tapMs)) }
  },
})

export const arcadeActions = [collectStadiumAction, upgradeStadiumAction, collectTrayAction, startPlayAction, finishPlayAction, startWarmupAction, finishWarmupAction]
