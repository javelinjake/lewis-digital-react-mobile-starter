import type { OwnedCard } from './cards'
import type { Player } from './catalogue'
import type { ClubState, DayCounter, PackSource } from './club-state'
import type { FlowContext, FlowResult, LedgerEntry } from './flow'
import type { Position } from './positions'
import { hashSeed } from '@ld/utils/random/rng'
import { dayIndex } from './advance'
import { albumSets, recordCollected } from './album'
import { benchHasRoom } from './cards'
import { GameRuleError } from './errors'
import { rollPack } from './packs'
import { addXp, recordProgress } from './progress'

export const NEW_CARD_PREFIX = 'new:'

export function usedToday(counter: DayCounter, day: number) {
  return counter.day === day ? counter.count : 0
}

export function bump(counter: DayCounter, day: number): DayCounter {
  return { day, count: usedToday(counter, day) + 1 }
}

/** Opens a pack: rolls the three players (seeded by how many packs this club has opened) and holds them as pending. */
function rollInto(ctx: FlowContext, state: ClubState, source: PackSource, options: { position?: Position, guaranteeStar?: boolean } = {}): ClubState {
  const { config } = ctx
  const roll = rollPack({
    catalogue: ctx.catalogue,
    tier: state.league.tier,
    pity: state.pity,
    seed: hashSeed(ctx.clubId, 'pack', state.packsOpened),
    config,
    position: options.position,
    guaranteeStar: options.guaranteeStar,
  })
  const next: ClubState = {
    ...state,
    packsOpened: state.packsOpened + 1,
    pity: roll.pityAfter,
    pendingPack: { no: state.packsOpened + 1, source, playerIds: roll.players.map(player => player.id), guaranteed: roll.guaranteed },
  }
  return addXp(recordProgress(next, 'openPacks'), config.pass.xp.pack, config)
}

function requireNoPending(state: ClubState) {
  if (state.pendingPack)
    throw new GameRuleError('pending-pack', 'Sign or sell the players from your last pack first.')
}

/** Opens a pack from the shelf, or a Star pack. */
export function openPack(ctx: FlowContext, source: 'shelf' | 'star'): FlowResult {
  const { state, config } = ctx
  requireNoPending(state)

  if (source === 'star') {
    if (state.starPacks < 1)
      throw new GameRuleError('no-packs', 'You have no Star packs.')
    return { state: rollInto(ctx, { ...state, starPacks: state.starPacks - 1 }, 'star', { guaranteeStar: true }) }
  }

  if (state.idle.shelfPacks < 1)
    throw new GameRuleError('no-packs', 'There are no packs on the shelf yet.')
  const capacity = state.idle.hasPass ? config.shelf.capacityWithPass : config.shelf.capacity
  // A full shelf has its clock stopped; taking a pack from it starts the clock again.
  const wasFull = state.idle.shelfPacks >= capacity
  const idle = { ...state.idle, shelfPacks: state.idle.shelfPacks - 1, shelfClockAt: wasFull ? ctx.now : state.idle.shelfClockAt }
  return { state: rollInto(ctx, { ...state, idle }, 'shelf') }
}

/** Buys an extra pack with coins, up to `extraPacksPerDay` a day. It is opened at once. */
export function buyPack(ctx: FlowContext): FlowResult {
  const { state, config, now } = ctx
  requireNoPending(state)
  const day = dayIndex(now, config)
  if (usedToday(state.extraPacks, day) >= config.shelf.extraPacksPerDay)
    throw new GameRuleError('daily-limit', `You can buy ${config.shelf.extraPacksPerDay} extra packs a day.`)
  if (state.coins < config.shelf.extraPackCoins)
    throw new GameRuleError('coins', `An extra pack costs ${config.shelf.extraPackCoins} coins.`)

  const paid: ClubState = { ...state, coins: state.coins - config.shelf.extraPackCoins, extraPacks: bump(state.extraPacks, day) }
  return {
    state: rollInto(ctx, paid, 'buy'),
    ledger: [{ currency: 'coins', amount: -config.shelf.extraPackCoins, reason: 'buy-pack' }],
  }
}

/** Buys an Arcade pack with tokens: players of the chosen position are more likely. */
export function arcadePack(ctx: FlowContext, position: Position): FlowResult {
  const { state, config } = ctx
  requireNoPending(state)
  if (!['GK', 'DEF', 'MID', 'FWD'].includes(position))
    throw new GameRuleError('position', 'Choose a position.')
  if (state.tokens < config.cabinets.arcadePackTokens)
    throw new GameRuleError('tokens', `An Arcade pack costs ${config.cabinets.arcadePackTokens} tokens.`)

  return {
    state: rollInto(ctx, { ...state, tokens: state.tokens - config.cabinets.arcadePackTokens }, 'arcade', { position }),
    ledger: [{ currency: 'tokens', amount: -config.cabinets.arcadePackTokens, reason: 'arcade-pack', ref: position }],
  }
}

export interface DecideResult {
  signed: number
  sold: number
  coins: number
}

/** Signs or sells each of the three players from the pending pack. A signed player becomes a one-star card on the bench. */
export function decidePack(ctx: FlowContext, decisions: readonly string[]): FlowResult<DecideResult> {
  const { state, config } = ctx
  const pending = state.pendingPack
  if (!pending)
    throw new GameRuleError('no-pending', 'There is no pack to sign or sell.')
  if (decisions.length !== pending.playerIds.length || decisions.some(choice => choice !== 'sign' && choice !== 'sell'))
    throw new GameRuleError('decisions', 'Choose sign or sell for every player.')

  const players = pending.playerIds.map((id) => {
    const player = ctx.players(id)
    if (!player)
      throw new Error(`The pack holds ${id}, which is not in the catalogue.`)
    return player
  })
  const signs = decisions.filter(choice => choice === 'sign').length
  if (!benchHasRoom(ctx.cards, state.lineup, config, signs))
    throw new GameRuleError('bench-full', `Your bench holds ${config.cards.benchSize} players. Sell some to make room.`)

  const signed: OwnedCard[] = []
  const ledger: LedgerEntry[] = []
  let coins = 0
  for (const [index, player] of players.entries()) {
    if (decisions[index] === 'sign') {
      signed.push({ id: `${NEW_CARD_PREFIX}${index}`, playerId: player.id, stars: 1, trained: 0 })
    }
    else {
      const value = config.cards.sellValue[player.rarity]
      coins += value
      ledger.push({ currency: 'coins', amount: value, reason: 'sell', ref: player.id })
    }
  }

  let next: ClubState = { ...state, coins: state.coins + coins, pendingPack: null }
  next = recordCollected(next, pending.playerIds, albumSets(ctx.catalogue, config))
  if (signs > 0)
    next = recordProgress(next, 'signPlayers', signs)

  return {
    state: next,
    cards: [...ctx.cards, ...signed],
    source: pending.source === 'arcade' ? 'arcade' : 'pack',
    ledger,
    extra: { signed: signs, sold: players.length - signs, coins },
  }
}

export type { Player }
