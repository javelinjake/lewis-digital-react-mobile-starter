import type { ActionContext } from '@ld/backend'
import { defineAction } from '@ld/backend'
import { CREST_COUNT, foundClub, mergeInClub, newClubState, sellCard, setLineup, trainInClub } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'
import { serverNow } from '../game/clock'
import { loadGame } from '../game/load'
import { findClub, mutateClub, rule, saveClub, stateJson } from '../game/mutate-club'

// Every game action is a defineAction: signed in, idempotent on its Idempotency-Key, rate limited and run in one
// transaction. The client says what it wants; the rules in @ld/pixel-pitch-core decide what happens.

const HEX = /^#[0-9a-f]{6}$/i

function text(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  if (typeof value !== 'string')
    throw new APIError(`Send ${key}.`, 400)
  return value
}

function cardId(body: Record<string, unknown>, key = 'cardId'): string {
  const value = body[key]
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new APIError(`Send ${key}.`, 400)
  return String(value)
}

/** Onboarding: names the club, picks crest and kit, signs the starter squad and plays the scripted first win. */
export const createClubAction = defineAction({
  path: '/game/club',
  rateLimit: { limit: 5, windowMs: 60_000 },
  handler: async (ctx: ActionContext) => {
    const { body, payload, req, user } = ctx
    const name = text(body, 'name').trim()
    const crest = Number(body.crest)
    const kitPrimary = text(body, 'kitPrimary')
    const kitSecondary = text(body, 'kitSecondary')
    if (name.length < 2 || name.length > 24)
      throw new APIError('A club name is 2 to 24 characters.', 400, { code: 'name' }, true)
    if (!Number.isInteger(crest) || crest < 0 || crest >= CREST_COUNT)
      throw new APIError('Pick one of the crests.', 400, { code: 'crest' }, true)
    if (!HEX.test(kitPrimary) || !HEX.test(kitSecondary))
      throw new APIError('Kit colours are #rrggbb.', 400, { code: 'kit' }, true)
    if (await findClub(ctx))
      throw new APIError('You already have a club.', 409, { code: 'club-exists' }, true)

    const now = serverNow(req)
    const game = await loadGame(payload)
    // The club is created empty first, to have the id that seeds its starter squad and its first match.
    const club = await payload.create({
      collection: 'clubs',
      data: { owner: Number(user.id), name, crest, kitPrimary, kitSecondary, state: stateJson(newClubState(now, game.config)), version: 0, tier: 1, points: 0, coins: 0 },
      depth: 0,
      overrideAccess: true,
      req,
    })

    const founded = rule(() => foundClub({ clubId: club.id, now, config: game.config, catalogue: game.catalogue, players: game.players }))
    const response = await saveClub(ctx, { game, club, state: founded.state, cards: [], now }, {
      state: founded.state,
      cards: founded.cards,
      source: 'starter',
      fixtures: [founded.debut],
      ledger: [{ currency: 'coins', amount: founded.debut.coins, reason: 'debut' }],
    }, { fixtures: [], events: founded.events })
    return { status: 201, body: response }
  },
})

/** Catches the club up to now. The app calls it on launch and on every resume. */
export const syncAction = defineAction({
  path: '/game/sync',
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ctx => ({ body: await mutateClub(ctx, ({ state }) => ({ state })) }),
})

/** Saves the formation and who plays where, and answers with the lineup's score. */
export const lineupAction = defineAction({
  path: '/game/lineup',
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const formation = text(ctx.body, 'formation')
    const lineup = ctx.body.lineup
    if (!Array.isArray(lineup) || lineup.some(id => id !== null && typeof id !== 'string' && typeof id !== 'number'))
      throw new APIError('Send lineup as five card ids (null for an empty slot).', 400)
    const ids = lineup.map(id => (id === null ? null : String(id)))

    const response = await mutateClub(ctx, ({ state, cards }) => ({ state: setLineup(state, formation, ids, cards) }))
    return { body: response }
  },
})

/** Sells a bench card for coins. */
export const sellAction = defineAction({
  path: '/game/sell',
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const id = cardId(ctx.body)
    return {
      body: await mutateClub(ctx, ({ state, cards, game }) => {
        const sold = sellCard(state, cards, id, game.players, game.config)
        return { state: sold.state, cards: sold.cards, ledger: [{ currency: 'coins', amount: sold.coins, reason: 'sell', ref: id }] }
      }),
    }
  },
})

/** Merges copies of one player into a card a star higher. */
export const mergeAction = defineAction({
  path: '/game/merge',
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const ids = ctx.body.cardIds
    if (!Array.isArray(ids))
      throw new APIError('Send cardIds.', 400)
    return {
      body: await mutateClub(ctx, ({ state, cards, game }) => {
        const merged = mergeInClub(state, cards, ids.map(String), game.config)
        return { state: merged.state, cards: merged.cards, source: 'merge' }
      }),
    }
  },
})

/** Spends coins on +1 rating for a card. */
export const trainAction = defineAction({
  path: '/game/train',
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const id = cardId(ctx.body)
    return {
      body: await mutateClub(ctx, ({ state, cards, game }) => {
        const trained = trainInClub(state, cards, id, game.players, game.config)
        return { state: trained.state, cards: trained.cards, ledger: [{ currency: 'coins', amount: trained.coins, reason: 'train', ref: id }] }
      }),
    }
  },
})

export const gameActions = [createClubAction, syncAction, lineupAction, sellAction, mergeAction, trainAction]
