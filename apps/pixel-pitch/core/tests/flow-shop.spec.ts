import type { ClubIdentity, ClubState, FlowContext, OwnedCard } from '../src'
import { describe, expect, it } from 'vitest'
import { applyPurchase, BASE_KITS, buyBenchSlots, buyKit, canBuy, changeIdentity, chooseSigning, closeSeason, DEFAULT_CONFIG, energyAt, foundClub, generateCatalogue, isGameRuleError, newClubState, parseConfig, passActive, rollDaily, rollSeason, seasonOf, signingOffer, spendEnergy, startWarmup, syncClub, tierRating, upgradeState, retryWarmup, refillEnergy, promotionGate } from '../src'

const config = DEFAULT_CONFIG
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const T0 = Date.UTC(2026, 10, 9, 12)
const catalogue = generateCatalogue(config)
const byId = new Map(catalogue.map(player => [player.id, player]))
const players = (id: string) => byId.get(id)
const identity: ClubIdentity = { crest: 3, kitPrimary: BASE_KITS[0].primary, kitSecondary: BASE_KITS[0].secondary }

const context = (patch: (state: ClubState) => ClubState = state => state, now = T0, cards: OwnedCard[] = []): FlowContext => ({
  state: patch(rollDaily(rollSeason(newClubState(T0, config), T0, config), T0, 'club-1', config)),
  cards,
  catalogue,
  players,
  config,
  clubId: 'club-1',
  now,
})
const withGems = (gems: number) => (state: ClubState) => ({ ...state, idle: { ...state.idle, gems } })
const code = (run: () => unknown) => {
  try {
    run()
    return 'accepted'
  }
  catch (error) {
    return isGameRuleError(error) ? error.code : 'other'
  }
}
/** The start of the season after T0's. */
const nextSeasonAt = (seasonOf(T0, config) + 1) * config.pass.seasonDays * DAY + HOUR

describe('the price list', () => {
  it('sells a starter offer, the Pass, the Licence and four gem packs, with nothing random in any of them', () => {
    expect(config.shop.products.map(product => [product.id, product.price])).toEqual([
      ['pp_starter', '£1.99'],
      ['pp_league_pass', '£3.99'],
      ['pp_chairman_licence', '£2.99'],
      ['pp_gems_80', '£0.99'],
      ['pp_gems_500', '£4.99'],
      ['pp_gems_1100', '£9.99'],
      ['pp_gems_2400', '£19.99'],
    ])
    const gems = config.shop.products.filter(product => product.kind === 'gems').map(product => product.rewards[0].amount)
    expect(gems).toEqual([...gems].sort((a, b) => a - b))
  })

  it('refuses an admin edit that names a kit that does not exist', () => {
    const premium = config.pass.premium.map((reward, index) => (index === 9 ? { kind: 'kit' as const, amount: 1, id: 'nope' } : reward))
    expect(() => parseConfig({ ...config, pass: { ...config.pass, premium } })).toThrow('nope')
  })

  it('fills the shop in for a config saved before it existed', () => {
    const { shop: _shop, cosmetics: _cosmetics, ...older } = config
    expect(parseConfig(older).shop).toEqual(config.shop)
  })
})

describe('applyPurchase', () => {
  it('turns the League Pass on for the season it was bought in, and it ends with that season', () => {
    const bought = applyPurchase(context(), 'pp_league_pass')!
    expect(bought.state.idle.hasPass).toBe(true)
    expect(passActive(bought.state, T0, config)).toBe(true)
    expect(canBuy(bought.state, config.shop.products[1], config, T0)).toBe(false)

    const later = syncClub({ state: bought.state, cards: [], players, clubId: 'club-1', config, now: nextSeasonAt })
    expect(later.state.idle.hasPass).toBe(false)
    expect(passActive(later.state, nextSeasonAt, config)).toBe(false)
  })

  it('pays gems instead when a second Pass is bought for the same season', () => {
    const first = applyPurchase(context(), 'pp_league_pass')!
    const second = applyPurchase({ ...context(), state: first.state }, 'pp_league_pass')!
    expect(second.state.idle.gems - first.state.idle.gems).toBe(config.pass.duplicateGems)
    expect(second.ledger).toEqual([{ currency: 'gems', amount: config.pass.duplicateGems, reason: 'purchase', ref: 'pp_league_pass' }])
  })

  it('pays a gem pack into the wallet with a ledger row', () => {
    const bought = applyPurchase(context(withGems(10)), 'pp_gems_500')!
    expect(bought.state.idle.gems).toBe(510)
    expect(bought.ledger).toEqual([{ currency: 'gems', amount: 500, reason: 'purchase', ref: 'pp_gems_500' }])
  })

  it('sells the starter offer once, in its first days, and pays a Star Signing, gems and coins', () => {
    const club = foundClub({ clubId: 'club-1', now: T0, config, catalogue, players })
    const ctx: FlowContext = { ...context(), state: club.state }
    const starter = config.shop.products.find(product => product.kind === 'starter')!
    expect(canBuy(club.state, starter, config, T0 + 71 * HOUR)).toBe(true)
    expect(canBuy(club.state, starter, config, T0 + 73 * HOUR)).toBe(false)
    const bought = applyPurchase(ctx, 'pp_starter')!
    expect(bought.state.signings.pending).toBe(1)
    expect(bought.state.idle.gems - club.state.idle.gems).toBe(300)
    expect(bought.state.coins - club.state.coins).toBe(5000)
    expect(canBuy(bought.state, starter, config, T0)).toBe(false)
  })

  it('unlocks the Licence (bigger bench, free kit changes) and ignores a product it does not know', () => {
    const bought = applyPurchase(context(), 'pp_chairman_licence')!
    expect(bought.state.perks.licence).toBe(true)
    expect(applyPurchase(context(), 'pp_unknown')).toBeNull()
  })
})

describe('the end of a season', () => {
  it('pays every tier reached but not claimed, on the premium track only if the Pass covered that season', () => {
    const reached = (hasPass: boolean) => context(state => ({
      ...state,
      idle: { ...state.idle, hasPass, passSeason: hasPass ? state.pass.season : -1 },
      pass: { ...state.pass, xp: 1000, claimedFree: [2] },
    })).state
    const free = closeSeason(reached(false), nextSeasonAt, config)
    expect(free.rewards).toEqual([4, 6, 8, 10].map(tier => config.pass.free[tier - 1]))
    expect(free.state.pass).toEqual({ season: seasonOf(nextSeasonAt, config), xp: 0, claimedFree: [], claimedPremium: [] })

    const premium = closeSeason(reached(true), nextSeasonAt, config)
    expect(premium.rewards).toHaveLength(4 + 10)
    expect(premium.state.kits).toEqual(['season-gold'])
    expect(premium.ledger.length).toBeGreaterThan(0)
  })

  it('tells the player through the catch-up', () => {
    const state = context(current => ({ ...current, pass: { ...current.pass, xp: 200 } })).state
    const synced = syncClub({ state, cards: [], players, clubId: 'club-1', config, now: nextSeasonAt })
    expect(synced.events).toContainEqual({ type: 'season-end', rewards: [config.pass.free[1]] })
  })
})

describe('what gems buy', () => {
  it('fills the energy bar, and refuses when it is full or the gems are short', () => {
    expect(code(() => refillEnergy(context(withGems(500))))).toBe('energy-full')
    const tired = context(state => spendEnergy(spendEnergy(withGems(500)(state), config, T0), config, T0))
    expect(energyAt(tired.state, config, T0)).toBe(3)
    const filled = refillEnergy(tired)
    expect(energyAt(filled.state, config, T0)).toBe(5)
    expect(filled.state.idle.gems).toBe(500 - config.shop.gems.energyRefill)
    expect(code(() => refillEnergy({ ...tired, state: withGems(10)(tired.state) }))).toBe('gems')
  })

  it('adds bench room up to three times', () => {
    let ctx = context(withGems(1000))
    for (let buy = 1; buy <= 3; buy++) {
      const bought = buyBenchSlots(ctx)
      expect(bought.extra!.bench).toBe(config.cards.benchSize + buy * 5)
      ctx = { ...ctx, state: bought.state }
    }
    expect(code(() => buyBenchSlots(ctx))).toBe('bench-max')
  })

  it('buys a second warm-up kick for a match, not the first', () => {
    const ctx = context(withGems(100))
    expect(code(() => retryWarmup(ctx))).toBe('warmup-free')
    const tried = startWarmup(ctx)
    const again = retryWarmup({ ...ctx, state: { ...tried.state, ticket: null } })
    expect(again.state.ticket?.kind).toBe('warmup')
    expect(again.state.idle.gems).toBe(100 - config.shop.gems.warmupRetry)
  })

  it('sells premium kits once, keeps Pass kits off sale, and charges for a change of look unless the Licence is held', () => {
    const ctx = context(withGems(1000))
    const bought = buyKit(ctx, 'claret', identity)
    expect(bought.extra!.identity.kitPrimary).toBe('#7a1f3d')
    expect(bought.state.kits).toEqual(['claret'])
    expect(code(() => buyKit({ ...ctx, state: bought.state }, 'claret', identity))).toBe('owned')
    expect(code(() => buyKit(ctx, 'season-gold', identity))).toBe('not-for-sale')

    expect(code(() => changeIdentity(ctx, { kitId: 'claret' }, identity))).toBe('no-kit')
    expect(code(() => changeIdentity(ctx, { kitId: BASE_KITS[0].id }, identity))).toBe('unchanged')
    const changed = changeIdentity(ctx, { kitId: BASE_KITS[2].id, crest: 9 }, identity)
    expect(changed.extra!.identity).toEqual({ crest: 9, kitPrimary: BASE_KITS[2].primary, kitSecondary: BASE_KITS[2].secondary })
    expect(changed.state.idle.gems).toBe(1000 - config.shop.gems.identityChange)

    const licensed = { ...ctx, state: { ...ctx.state, perks: { ...ctx.state.perks, licence: true } } }
    expect(changeIdentity(licensed, { crest: 1 }, identity).state.idle.gems).toBe(1000)
  })
})

describe('Star Signings', () => {
  it('offer three named Stars, the same until one is chosen, and sign the chosen one', () => {
    const ctx = context(state => ({ ...state, signings: { pending: 1, taken: 0 } }))
    const offer = signingOffer(ctx.state, ctx.clubId, catalogue)
    expect(offer).toHaveLength(3)
    expect(offer.every(player => player.rarity === 'star')).toBe(true)
    expect(signingOffer(ctx.state, ctx.clubId, catalogue)).toEqual(offer)

    const notOffered = catalogue.find(player => player.rarity === 'star' && !offer.includes(player))!
    expect(code(() => chooseSigning(ctx, notOffered.id))).toBe('not-offered')
    const signed = chooseSigning(ctx, offer[1].id)
    expect(signed.cards).toEqual([{ id: 'new:signing', playerId: offer[1].id, stars: 1, trained: 0 }])
    expect(signed.state.signings).toEqual({ pending: 0, taken: 1 })
    expect(signed.state.album.collected).toContain(offer[1].id)
    expect(code(() => chooseSigning({ ...ctx, state: signed.state }, offer[0].id))).toBe('no-signing')
  })
})

describe('the first session', () => {
  it('starts with packs on the shelf, a league match minutes away and the starter offer on sale', () => {
    const club = foundClub({ clubId: 'club-1', now: T0, config, catalogue, players })
    expect(club.state.idle.shelfPacks).toBe(config.onboarding.starterShelfPacks)
    expect(club.state.league.nextKickoffAt).toBe(T0 + config.league.firstMatchMinutes * 60_000)
    expect(club.state.starterOffer).toEqual({ until: T0 + 72 * HOUR, bought: false })
  })
})

describe('promotion and the ladder', () => {
  it('pays gems and a Star pack on promotion', () => {
    const club = foundClub({ clubId: 'club-1', now: T0, config, catalogue, players })
    const cards = club.cards.map((card, index) => ({ ...card, id: String(index + 1) }))
    const state = { ...club.state, lineup: club.state.lineup.map(id => (id ? String(Number(id.slice(4)) + 1) : null)), league: { ...club.state.league, points: promotionGate(1, config) } }
    const synced = syncClub({ state, cards, players, clubId: 'club-1', config, now: state.league.nextKickoffAt })
    const promotion = synced.events.find(event => event.type === 'promotion')
    expect(promotion).toEqual({ type: 'promotion', tier: 2, rewards: config.league.promotionRewards })
    expect(synced.state.starPacks).toBe(club.state.starPacks + 1)
    expect(synced.ledger).toContainEqual({ currency: 'gems', amount: 50, reason: 'promotion', ref: '2' })
  })

  it('grows rivals more slowly past League 1 and never past the cap', () => {
    const { rivalBaseRating, rivalStep, rivalPrestigeStep } = config.league
    expect(tierRating(5, config)).toBe(rivalBaseRating + 4 * rivalStep)
    expect(tierRating(6, config) - tierRating(5, config)).toBe(rivalPrestigeStep)
    expect(rivalPrestigeStep).toBeLessThan(rivalStep)
    expect(tierRating(50, config)).toBe(config.league.rivalMaxRating)
  })
})

describe('upgradeState for the shop', () => {
  it('adds the new fields to an older club and keeps a Pass it had for the season it was in', () => {
    const { perks: _perks, signings: _signings, kits: _kits, starterOffer: _offer, ...older } = context().state
    const { passSeason: _season, ...idle } = older.idle
    const upgraded = upgradeState({ ...older, idle: { ...idle, hasPass: true } as never }, config)
    expect(upgraded.perks).toEqual({ licence: false, benchBuys: 0 })
    expect(upgraded.signings).toEqual({ pending: 0, taken: 0 })
    expect(upgraded.kits).toEqual([])
    expect(upgraded.idle.passSeason).toBe(older.pass.season)
  })
})
