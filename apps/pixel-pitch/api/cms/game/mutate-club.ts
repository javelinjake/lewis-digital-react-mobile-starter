import type { ActionContext } from '@ld/backend'
import type { ClubState, FixtureResult, OwnedCard, WelcomeBackEvent } from '@ld/pixel-pitch-core'
import type { PayloadRequest } from 'payload'
import type { Card, Club, Fixture } from '../../payload-types'
import type { LoadedGame } from './load'
import { lockRows } from '@ld/backend'
import { isGameRuleError, NEW_CARD_PREFIX, syncClub } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'
import { serverNow } from './clock'
import { loadGame } from './load'

type Currency = 'coins' | 'gems' | 'tokens'
type CardSource = Card['source']

export interface LedgerEntry {
  currency: Currency
  amount: number
  reason: string
  ref?: string
}

/** What a game action decided. Everything is written in the action's transaction. */
export interface Outcome<T> {
  state: ClubState
  /** The squad after the action, if it changed. Ids starting with `NEW_CARD_PREFIX` are created. */
  cards?: OwnedCard[]
  /** Where new cards came from. */
  source?: CardSource
  ledger?: LedgerEntry[]
  /** Matches the action played on top of the catch-up (the debut). */
  fixtures?: FixtureResult[]
  /** Extra fields for the response. */
  extra?: T
}

export interface GameInput {
  game: LoadedGame
  club: Club
  state: ClubState
  cards: OwnedCard[]
  now: number
}

export interface ClubView {
  id: number
  name: string
  crest: number
  kitPrimary: string
  kitSecondary: string
  state: ClubState
  version: number
}

export interface CardView extends OwnedCard {}

/** What every game action answers with: the club as it now is, its squad, and what happened. */
export interface GameResponse {
  club: ClubView
  cards: CardView[]
  /** Matches played by this request, oldest first. */
  fixtures: FixtureResult[]
  events: WelcomeBackEvent[]
  /** The server's time for this answer, so the app's countdowns start from the server clock. */
  now: number
  configVersion: number
}

export const toOwnedCard = (doc: Card): OwnedCard => ({ id: String(doc.id), playerId: doc.playerId, stars: doc.stars, trained: doc.trained })

export function toClubView(club: Club, state: ClubState, version: number): ClubView {
  return {
    id: club.id,
    name: club.name,
    crest: club.crest,
    kitPrimary: club.kitPrimary,
    kitSecondary: club.kitSecondary,
    state,
    version,
  }
}

/** A rule from `core` refused the request: answer 400 with its code, which the app shows. Anything else is a bug. */
export function asApiError(error: unknown): unknown {
  return isGameRuleError(error) ? new APIError(error.message, 400, { code: error.code }, true) : error
}

/** Runs a rule from `core`, turning a refused request into a 400 the app can show. */
export function rule<T>(run: () => T): T {
  try {
    return run()
  }
  catch (error) {
    throw asApiError(error)
  }
}

/**
 * Locks the caller's club row for the rest of the action's transaction. Every game action that writes the club calls
 * this first, so two devices acting at once are applied one after the other.
 */
export async function lockClub(ctx: ActionContext) {
  await lockRows(ctx.req, 'clubs', 'owner_id', Number(ctx.user.id))
}

export async function findClub(ctx: ActionContext): Promise<Club | undefined> {
  const result = await ctx.payload.find({ collection: 'clubs', where: { owner: { equals: ctx.user.id } }, limit: 1, depth: 0, overrideAccess: false, user: ctx.user, req: ctx.req })
  return result.docs[0]
}

export async function findCards(ctx: ActionContext): Promise<OwnedCard[]> {
  const result = await ctx.payload.find({ collection: 'cards', where: { owner: { equals: ctx.user.id } }, pagination: false, limit: 1000, depth: 0, sort: 'id', overrideAccess: false, user: ctx.user, req: ctx.req })
  return result.docs.map(toOwnedCard)
}

/** Creates, updates and deletes card documents to match `next`, and returns the ids new cards were given. */
async function writeCards(req: PayloadRequest, ownerId: number | string, before: OwnedCard[], next: OwnedCard[], source: CardSource) {
  const realIds = new Map<string, string>()
  const old = new Map(before.map(card => [card.id, card]))
  const kept = new Set(next.map(card => card.id))

  for (const card of before) {
    if (!kept.has(card.id))
      await req.payload.delete({ collection: 'cards', id: Number(card.id), overrideAccess: true, req })
  }
  for (const card of next) {
    if (card.id.startsWith(NEW_CARD_PREFIX)) {
      const created = await req.payload.create({
        collection: 'cards',
        data: { owner: Number(ownerId), playerId: card.playerId, stars: card.stars, trained: card.trained, source },
        depth: 0,
        overrideAccess: true,
        req,
      })
      realIds.set(card.id, String(created.id))
      continue
    }
    const previous = old.get(card.id)
    if (previous && (previous.stars !== card.stars || previous.trained !== card.trained))
      await req.payload.update({ collection: 'cards', id: Number(card.id), data: { stars: card.stars, trained: card.trained }, overrideAccess: true, req })
  }
  return realIds
}

function fixtureData(ownerId: number | string, fixture: FixtureResult, configVersion: number): Omit<Fixture, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    owner: Number(ownerId),
    no: fixture.no,
    kind: fixture.no < 0 ? 'debut' : 'league',
    tier: fixture.tier,
    kickoffAt: fixture.kickoffAt,
    rival: fixture.rival,
    goalsFor: fixture.goalsFor,
    goalsAgainst: fixture.goalsAgainst,
    result: fixture.result,
    points: fixture.points,
    coins: fixture.coins,
    events: fixture.events,
    warmupBonus: fixture.warmupBonus,
    promotedTo: fixture.promotedTo,
    configVersion,
  }
}

/** Payload's JSON field type has an index signature; the club state is a plain object, so it fits, but TS needs telling. */
export const stateJson = (state: ClubState) => state as unknown as Record<string, unknown>
export const readState = (club: Club) => club.state as unknown as ClubState

const balanceOf = (state: ClubState, currency: Currency) => (currency === 'coins' ? state.coins : currency === 'gems' ? state.idle.gems : state.tokens)

/**
 * Writes the outcome of a game action: cards, fixtures, ledger rows and the club itself, in the action's transaction.
 * The club is written only if nobody else changed it since it was read (its `version`); otherwise the request fails
 * with 409 and the app retries with a fresh sync.
 */
export async function saveClub<T>(ctx: ActionContext, input: GameInput, outcome: Outcome<T>, caughtUp: { fixtures: FixtureResult[], events: WelcomeBackEvent[] }): Promise<GameResponse & T> {
  const { req, user } = ctx
  const { club, game, now } = input
  let state = outcome.state
  let cards = input.cards

  if (outcome.cards) {
    const realIds = await writeCards(req, user.id, input.cards, outcome.cards, outcome.source ?? 'pack')
    cards = outcome.cards.map(card => ({ ...card, id: realIds.get(card.id) ?? card.id }))
    state = { ...state, lineup: state.lineup.map(id => (id !== null ? realIds.get(id) ?? id : null)) }
  }

  const fixtures = [...caughtUp.fixtures, ...(outcome.fixtures ?? [])]
  for (const fixture of fixtures)
    await req.payload.create({ collection: 'fixtures', data: fixtureData(user.id, fixture, game.config.version), depth: 0, overrideAccess: true, req })

  const ledger: LedgerEntry[] = []
  const matchCoins = caughtUp.fixtures.reduce((sum, fixture) => sum + fixture.coins, 0)
  if (matchCoins > 0)
    ledger.push({ currency: 'coins', amount: matchCoins, reason: 'matches', ref: `fixtures ${caughtUp.fixtures[0].no}-${caughtUp.fixtures.at(-1)!.no}` })
  for (const event of caughtUp.events) {
    if (event.type === 'gems')
      ledger.push({ currency: 'gems', amount: event.amount, reason: 'daily-gems' })
  }
  ledger.push(...(outcome.ledger ?? []))
  for (const entry of ledger) {
    await req.payload.create({
      collection: 'ledger',
      data: { owner: Number(user.id), currency: entry.currency, amount: entry.amount, balance: balanceOf(state, entry.currency), reason: entry.reason, ref: entry.ref },
      depth: 0,
      overrideAccess: true,
      req,
    })
  }

  const version = club.version + 1
  const written = await req.payload.update({
    collection: 'clubs',
    where: { and: [{ id: { equals: club.id } }, { version: { equals: club.version } }] },
    data: { state: stateJson(state), version, tier: state.league.tier, points: state.league.points, coins: state.coins },
    depth: 0,
    overrideAccess: true,
    req,
  })
  // The row is locked (`lockClub`), so this cannot happen unless an action forgot to lock: fail rather than overwrite.
  if (written.docs.length !== 1)
    throw new APIError('Your club changed on another device. Try again.', 409, { code: 'conflict' }, true)

  return {
    club: toClubView(club, state, version),
    cards,
    fixtures,
    events: caughtUp.events,
    now,
    configVersion: game.config.version,
    ...(outcome.extra ?? {} as T),
  }
}

/**
 * The shape of every game action after onboarding: load the caller's club and squad, catch it up to the server's
 * now (shelf, gems, matches), apply the action's rule, and save the lot with a version check.
 */
export async function mutateClub<T = object>(ctx: ActionContext, apply: (input: GameInput) => Outcome<T> | Promise<Outcome<T>>): Promise<GameResponse & T> {
  const now = serverNow(ctx.req)
  const game = await loadGame(ctx.payload)
  await lockClub(ctx)
  const club = await findClub(ctx)
  if (!club)
    throw new APIError('Create your club first.', 404, { code: 'no-club' }, true)
  const cards = await findCards(ctx)

  const synced = syncClub({ state: readState(club), cards, players: game.players, clubId: club.id, config: game.config, now })
  const input = { game, club, state: synced.state, cards, now }
  let outcome: Outcome<T>
  try {
    outcome = await apply(input)
  }
  catch (error) {
    throw asApiError(error)
  }
  return saveClub(ctx, input, outcome, synced)
}
