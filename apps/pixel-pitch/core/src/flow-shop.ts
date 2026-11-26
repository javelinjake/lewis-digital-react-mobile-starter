import type { OwnedCard } from './cards'
import type { Player } from './catalogue'
import type { ClubState } from './club-state'
import type { ClubIdentity, IdentityChange } from './api-types'
import type { GameConfig, Reward } from './config'
import type { FlowContext, FlowResult, LedgerEntry } from './flow'
import { createRng, hashSeed } from '@ld/utils/random/rng'
import { albumSets, recordCollected } from './album'
import { BASE_KITS, CREST_COUNT } from './api-types'
import { benchHasRoom, benchLimit } from './cards'
import { energyAt, energyMax } from './energy'
import { GameRuleError } from './errors'
import { startWarmup } from './flow-arcade'
import { NEW_CARD_PREFIX } from './flow-packs'
import { grantReward, passActive, recordProgress, seasonOf } from './progress'

// Everything money and gems buy. The rule throughout: pay for time, choice and looks, never for a mystery. A product
// pays things the player can see before paying, and gems never buy a random pack.

export type Product = GameConfig['shop']['products'][number]

export function productById(config: GameConfig, productId: string): Product | undefined {
  return config.shop.products.find(product => product.id === productId)
}

/** Whether a product can be bought right now. The shop hides what cannot; `applyPurchase` still pays if the store took money. */
export function canBuy(state: ClubState, product: Product, config: GameConfig, now: number): boolean {
  switch (product.kind) {
    case 'pass':
      return !passActive(state, now, config)
    case 'licence':
      return !state.perks.licence
    case 'starter':
      return !state.starterOffer.bought && now < state.starterOffer.until
    case 'gems':
      return true
  }
}

function payAll(state: ClubState, rewards: readonly Reward[], reason: string, ref: string) {
  let next = state
  const ledger: LedgerEntry[] = []
  for (const reward of rewards) {
    const paid = grantReward(next, reward, reason, ref)
    next = paid.state
    ledger.push(...paid.ledger)
  }
  return { state: next, ledger }
}

/**
 * Pays for a store purchase. It runs when the store has already taken the money (the RevenueCat webhook), so it never
 * refuses a product it knows: a second Pass for the same season pays `pass.duplicateGems` instead, and a starter offer
 * bought late still pays. A product id it does not know returns null, so the webhook records it and grants nothing.
 */
export function applyPurchase(ctx: FlowContext, productId: string): FlowResult<{ product: Product, rewards: Reward[] }> | null {
  const { state, config, now } = ctx
  const product = productById(config, productId)
  if (!product)
    return null
  const ref = product.id
  switch (product.kind) {
    case 'pass': {
      if (passActive(state, now, config)) {
        const rewards: Reward[] = [{ kind: 'gems', amount: config.pass.duplicateGems }]
        return { ...payAll(state, rewards, 'purchase', ref), extra: { product, rewards } }
      }
      // Bought mid-season, it unlocks every premium tier already reached (they are claimed as usual).
      const next = { ...state, idle: { ...state.idle, hasPass: true, passSeason: seasonOf(now, config) } }
      return { state: next, ledger: [], extra: { product, rewards: [] } }
    }
    case 'licence':
      return { state: { ...state, perks: { ...state.perks, licence: true } }, ledger: [], extra: { product, rewards: [] } }
    case 'starter': {
      const paid = payAll({ ...state, starterOffer: { ...state.starterOffer, bought: true } }, product.rewards, 'purchase', ref)
      return { ...paid, extra: { product, rewards: product.rewards } }
    }
    case 'gems':
      return { ...payAll(state, product.rewards, 'purchase', ref), extra: { product, rewards: product.rewards } }
  }
}

function spendGems(state: ClubState, amount: number, reason: string, ref?: string): { state: ClubState, ledger: LedgerEntry[] } {
  if (state.idle.gems < amount)
    throw new GameRuleError('gems', `That costs ${amount} gems. You have ${state.idle.gems}.`)
  if (amount === 0)
    return { state, ledger: [] }
  return { state: { ...state, idle: { ...state.idle, gems: state.idle.gems - amount } }, ledger: [{ currency: 'gems', amount: -amount, reason, ref }] }
}

/** Fills the arcade's energy bar at once. */
export function refillEnergy(ctx: FlowContext): FlowResult<{ energy: number }> {
  const { state, config, now } = ctx
  if (energyAt(state, config, now) >= energyMax(state, config))
    throw new GameRuleError('energy-full', 'Your energy is already full.')
  const paid = spendGems(state, config.shop.gems.energyRefill, 'energy-refill')
  return { state: { ...paid.state, energy: { fullAt: now } }, ledger: paid.ledger, extra: { energy: energyMax(state, config) } }
}

/** Adds `benchSlotsEach` places on the bench, up to `benchSlotsMaxBuys` times. */
export function buyBenchSlots(ctx: FlowContext): FlowResult<{ bench: number }> {
  const { state, config } = ctx
  if (state.perks.benchBuys >= config.shop.benchSlotsMaxBuys)
    throw new GameRuleError('bench-max', 'Your bench is as big as it gets.')
  const paid = spendGems(state, config.shop.gems.benchSlots, 'bench-slots')
  const next = { ...paid.state, perks: { ...paid.state.perks, benchBuys: paid.state.perks.benchBuys + 1 } }
  return { state: next, ledger: paid.ledger, extra: { bench: benchLimit(next, config) } }
}

/** A second warm-up kick for the same match, for gems. The new result replaces the old one. */
export function retryWarmup(ctx: FlowContext): FlowResult {
  const { state, config } = ctx
  if (state.warmupTriedFor !== state.league.fixtureNo)
    throw new GameRuleError('warmup-free', 'Your warm-up for this match is still free.')
  const paid = spendGems(state, config.shop.gems.warmupRetry, 'warmup-retry')
  const started = startWarmup({ ...ctx, state: { ...paid.state, warmupTriedFor: -1 } })
  return { state: started.state, ledger: paid.ledger }
}

/** Every kit this club may wear: the eight base kits and the premium kits it owns. */
export function wearableKits(state: Pick<ClubState, 'kits'>, config: GameConfig) {
  return [...BASE_KITS, ...config.cosmetics.kits.filter(kit => state.kits.includes(kit.id))]
}

/** Buys a premium kit with gems and puts it on. */
export function buyKit(ctx: FlowContext, kitId: string, current: ClubIdentity): FlowResult<{ identity: ClubIdentity }> {
  const { state, config } = ctx
  const kit = config.cosmetics.kits.find(entry => entry.id === kitId)
  if (!kit)
    throw new GameRuleError('no-kit', 'There is no such kit.')
  if (state.kits.includes(kitId))
    throw new GameRuleError('owned', 'You already own that kit.')
  if (kit.gems === null)
    throw new GameRuleError('not-for-sale', 'That kit is a League Pass reward.')
  const paid = spendGems(state, kit.gems, 'kit', kitId)
  return {
    state: { ...paid.state, kits: [...paid.state.kits, kitId] },
    ledger: paid.ledger,
    extra: { identity: { ...current, kitPrimary: kit.primary, kitSecondary: kit.secondary } },
  }
}

/** Changes the club's kit and/or crest. Free with the Chairman's Licence, otherwise `shop.gems.identityChange` gems. */
export function changeIdentity(ctx: FlowContext, change: IdentityChange, current: ClubIdentity): FlowResult<{ identity: ClubIdentity }> {
  const { state, config } = ctx
  const identity = { ...current }
  if (change.kitId !== undefined) {
    const kit = wearableKits(state, config).find(entry => entry.id === change.kitId)
    if (!kit)
      throw new GameRuleError('no-kit', 'You do not have that kit.')
    identity.kitPrimary = kit.primary
    identity.kitSecondary = kit.secondary
  }
  if (change.crest !== undefined) {
    if (!Number.isInteger(change.crest) || change.crest < 0 || change.crest >= CREST_COUNT)
      throw new GameRuleError('crest', 'Pick one of the crests.')
    identity.crest = change.crest
  }
  if (identity.crest === current.crest && identity.kitPrimary === current.kitPrimary && identity.kitSecondary === current.kitSecondary)
    throw new GameRuleError('unchanged', 'That is what you are wearing already.')
  const paid = spendGems(state, state.perks.licence ? 0 : config.shop.gems.identityChange, 'identity')
  return { state: paid.state, ledger: paid.ledger, extra: { identity } }
}

/**
 * The three Star players a Star Signing offers. Fixed for the club until one is chosen (seeded by how many it has
 * taken), so it can be shown before buying and is never re-rolled. Players the club has never pulled come first.
 */
export function signingOffer(state: Pick<ClubState, 'signings' | 'album'>, clubId: string | number, catalogue: readonly Player[]): Player[] {
  const rng = createRng(hashSeed(clubId, 'signing', state.signings.taken))
  const stars = rng.shuffle(catalogue.filter(player => player.rarity === 'star'))
  const seen = new Set(state.album.collected)
  return [...stars.filter(player => !seen.has(player.id)), ...stars.filter(player => seen.has(player.id))].slice(0, 3)
}

/** Uses a Star Signing on one of the offered players, who joins the bench. */
export function chooseSigning(ctx: FlowContext, playerId: string): FlowResult<{ player: Player }> {
  const { state, config, clubId, catalogue, cards } = ctx
  if (state.signings.pending < 1)
    throw new GameRuleError('no-signing', 'You have no Star Signing to use.')
  const player = signingOffer(state, clubId, catalogue).find(entry => entry.id === playerId)
  if (!player)
    throw new GameRuleError('not-offered', 'That player is not one of your Star Signing choices.')
  if (!benchHasRoom(cards, state.lineup, config, 1, benchLimit(state, config)))
    throw new GameRuleError('bench-full', `Your bench holds ${benchLimit(state, config)} players. Sell one to make room.`)
  const card: OwnedCard = { id: `${NEW_CARD_PREFIX}signing`, playerId: player.id, stars: 1, trained: 0 }
  let next: ClubState = { ...state, signings: { pending: state.signings.pending - 1, taken: state.signings.taken + 1 } }
  next = recordProgress(recordCollected(next, [player.id], albumSets(catalogue, config)), 'signPlayers')
  return { state: next, cards: [...cards, card], source: 'pack', extra: { player } }
}
