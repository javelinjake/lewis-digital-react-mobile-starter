import type { Position } from '@ld/pixel-pitch-core'
import { defineAction } from '@ld/backend'
import { arcadePack, buyPack, decidePack, openPack } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'
import { flowContext, mutateClub } from '../game/mutate-club'

// Every pack action is the rules' own function run on the club's state: the server decides what is rolled, from a seed
// that depends only on the club and how many packs it has opened. The app only asks.

const limits = { rateLimit: { limit: 60, windowMs: 60_000 } }

/** Opens a pack from the shelf, or a Star pack. The three players wait to be signed or sold. */
export const openPackAction = defineAction({
  path: '/game/packs/open',
  ...limits,
  handler: async (ctx) => {
    const source = ctx.body.source === 'star' ? 'star' : 'shelf'
    return { body: await mutateClub(ctx, input => openPack(flowContext(input), source)) }
  },
})

/** Buys an extra pack with coins (3 a day). It is opened at once. */
export const buyPackAction = defineAction({
  path: '/game/packs/buy',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => buyPack(flowContext(input))) }),
})

/** Buys an Arcade pack with tokens, for a chosen position. */
export const arcadePackAction = defineAction({
  path: '/game/packs/arcade',
  ...limits,
  handler: async (ctx) => {
    const position = ctx.body.position
    if (typeof position !== 'string')
      throw new APIError('Send position.', 400)
    return { body: await mutateClub(ctx, input => arcadePack(flowContext(input), position as Position)) }
  },
})

/** Signs or sells each player from the pending pack. */
export const decidePackAction = defineAction({
  path: '/game/packs/decide',
  ...limits,
  handler: async (ctx) => {
    const decisions = ctx.body.decisions
    if (!Array.isArray(decisions) || decisions.some(choice => typeof choice !== 'string'))
      throw new APIError('Send decisions: "sign" or "sell" for each player.', 400)
    return { body: await mutateClub(ctx, input => decidePack(flowContext(input), decisions as string[])) }
  },
})

export const packActions = [openPackAction, buyPackAction, arcadePackAction, decidePackAction]
