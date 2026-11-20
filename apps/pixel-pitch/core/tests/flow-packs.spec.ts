import type { ClubState, FlowContext, OwnedCard } from '../src'
import { createRng } from '@ld/utils/random/rng'
import { describe, expect, it } from 'vitest'
import { arcadePack, benchCount, buyPack, DEFAULT_CONFIG, decidePack, generateCatalogue, isGameRuleError, isStarOrBetter, newClubState, NEW_CARD_PREFIX, openPack, pickGoals, usedToday } from '../src'

const config = DEFAULT_CONFIG
const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 9, 12)
const catalogue = generateCatalogue(config)
const byId = new Map(catalogue.map(player => [player.id, player]))

function context(overrides: Partial<ClubState> = {}, cards: OwnedCard[] = [], now = T0): FlowContext {
  const base = newClubState(T0, config)
  const state: ClubState = { ...base, ...overrides, idle: { ...base.idle, shelfPacks: 5, ...overrides.idle } }
  return { state, cards, catalogue, players: id => byId.get(id), config, clubId: 'club-1', now }
}
const code = (run: () => unknown) => {
  try {
    run()
    return 'accepted'
  }
  catch (error) {
    return isGameRuleError(error) ? error.code : 'other'
  }
}
/** Applies a flow result to a context, as the api does. */
const apply = (ctx: FlowContext, result: { state: ClubState, cards?: OwnedCard[] }): FlowContext => ({ ...ctx, state: result.state, cards: result.cards ?? ctx.cards })

describe('openPack', () => {
  it('takes a pack off the shelf and holds three players to sign or sell', () => {
    const ctx = context()
    const { state } = openPack(ctx, 'shelf')
    expect(state.idle.shelfPacks).toBe(4)
    expect(state.packsOpened).toBe(1)
    expect(state.pendingPack).toMatchObject({ no: 1, source: 'shelf' })
    expect(state.pendingPack!.playerIds).toHaveLength(config.shelf.playersPerPack)
    expect(state.pendingPack!.playerIds.every(id => byId.has(id))).toBe(true)
  })

  it('rolls the same players for the same club and pack number, and others for the next pack', () => {
    const first = openPack(context(), 'shelf').state.pendingPack!.playerIds
    expect(openPack(context(), 'shelf').state.pendingPack!.playerIds).toEqual(first)
    const second = openPack(context({ packsOpened: 1 }), 'shelf').state.pendingPack!.playerIds
    expect(second).not.toEqual(first)
    expect(openPack({ ...context(), clubId: 'club-2' }, 'shelf').state.pendingPack!.playerIds).not.toEqual(first)
  })

  it('refuses while a pack is waiting, and when the shelf is empty', () => {
    const open = openPack(context(), 'shelf')
    expect(code(() => openPack(apply(context(), open), 'shelf'))).toBe('pending-pack')
    expect(code(() => openPack(context({ idle: { ...newClubState(T0, config).idle, shelfPacks: 0 } }), 'shelf'))).toBe('no-packs')
  })

  it('restarts the shelf clock when it takes a pack from a full shelf, and only then', () => {
    const full = context({ idle: { ...newClubState(T0, config).idle, shelfPacks: config.shelf.capacity, shelfClockAt: T0 - DAY } }, [], T0 + 5)
    expect(openPack(full, 'shelf').state.idle.shelfClockAt).toBe(T0 + 5)
    const notFull = context({ idle: { ...newClubState(T0, config).idle, shelfPacks: 3, shelfClockAt: T0 - 1000 } }, [], T0 + 5)
    expect(openPack(notFull, 'shelf').state.idle.shelfClockAt).toBe(T0 - 1000)
  })

  it('counts towards the open-packs goal and Pass XP', () => {
    const goals = pickGoals('club-1', 0, config).map(goal => ({ ...goal, kind: 'openPacks' as const, target: 3 })).slice(0, 1)
    const ctx = context({ daily: { day: 0, goals, freePackClaimed: false }, pass: { season: 0, xp: 0, claimedFree: [], claimedPremium: [] } })
    const { state } = openPack(ctx, 'shelf')
    expect(state.daily.goals[0].progress).toBe(1)
    expect(state.pass.xp).toBe(config.pass.xp.pack)
  })

  it('opens a Star pack with at least one Star or better, and uses it up', () => {
    for (let club = 0; club < 60; club++) {
      const ctx = { ...context({ starPacks: 1 }), clubId: `club-${club}` }
      const { state } = openPack(ctx, 'star')
      expect(state.starPacks).toBe(0)
      expect(state.idle.shelfPacks).toBe(5)
      expect(state.pendingPack!.playerIds.some(id => isStarOrBetter(byId.get(id)!.rarity))).toBe(true)
    }
    expect(code(() => openPack(context(), 'star'))).toBe('no-packs')
  })

  it('never goes 40 players without a Star, however the packs are opened', () => {
    let ctx = context({ idle: { ...newClubState(T0, config).idle, shelfPacks: 0 } })
    let sinceStar = 0
    for (let pack = 0; pack < 400; pack++) {
      ctx = { ...ctx, state: { ...ctx.state, idle: { ...ctx.state.idle, shelfPacks: 1 } } }
      const opened = openPack(ctx, 'shelf')
      for (const id of opened.state.pendingPack!.playerIds) {
        sinceStar = isStarOrBetter(byId.get(id)!.rarity) ? 0 : sinceStar + 1
        expect(sinceStar).toBeLessThan(config.packs.pityPlayers)
      }
      ctx = apply(ctx, { state: { ...opened.state, pendingPack: null } })
    }
  })
})

describe('buyPack', () => {
  it('costs coins, opens at once and is limited to 3 a day, starting again the next day', () => {
    let ctx = context({ coins: 20_000 })
    for (let bought = 0; bought < config.shelf.extraPacksPerDay; bought++) {
      const result = buyPack(ctx)
      expect(result.ledger).toEqual([{ currency: 'coins', amount: -config.shelf.extraPackCoins, reason: 'buy-pack' }])
      expect(result.state.pendingPack).toMatchObject({ source: 'buy' })
      expect(result.state.idle.shelfPacks).toBe(5)
      ctx = apply(ctx, { state: { ...result.state, pendingPack: null } })
    }
    expect(ctx.state.coins).toBe(20_000 - 3 * config.shelf.extraPackCoins)
    expect(code(() => buyPack(ctx))).toBe('daily-limit')
    const tomorrow = { ...ctx, now: T0 + DAY }
    expect(buyPack(tomorrow).state.extraPacks.count).toBe(1)
    expect(usedToday(ctx.state.extraPacks, Math.floor(T0 / DAY))).toBe(3)
  })

  it('refuses without the coins, and while a pack is waiting', () => {
    expect(code(() => buyPack(context({ coins: 1999 })))).toBe('coins')
    expect(code(() => buyPack(context({ coins: 5000, pendingPack: { no: 1, source: 'shelf', playerIds: ['p001', 'p002', 'p003'], guaranteed: [false, false, false] } })))).toBe('pending-pack')
  })
})

describe('arcadePack', () => {
  it('costs 300 tokens and makes the chosen position more likely', () => {
    const share = (position: 'GK' | 'FWD' | undefined) => {
      let hits = 0
      let total = 0
      for (let seed = 0; seed < 400; seed++) {
        const ctx = { ...context({ tokens: 1000, packsOpened: seed }), clubId: 'boost' }
        const ids = (position ? arcadePack(ctx, position) : openPack(ctx, 'shelf')).state.pendingPack!.playerIds
        total += ids.length
        hits += ids.filter(id => byId.get(id)!.position === 'GK').length
      }
      return hits / total
    }
    expect(share('GK')).toBeGreaterThan(share(undefined) * 1.4)
    const bought = arcadePack(context({ tokens: 1000 }), 'FWD')
    expect(bought.state.tokens).toBe(700)
    expect(bought.ledger).toEqual([{ currency: 'tokens', amount: -300, reason: 'arcade-pack', ref: 'FWD' }])
    expect(bought.state.pendingPack!.source).toBe('arcade')
  })

  it('refuses without the tokens or with a made-up position', () => {
    expect(code(() => arcadePack(context({ tokens: 299 }), 'GK'))).toBe('tokens')
    expect(code(() => arcadePack(context({ tokens: 999 }), 'WING' as never))).toBe('position')
  })
})

describe('decidePack', () => {
  const opened = () => apply(context(), openPack(context(), 'shelf'))

  it('signs players as one-star cards on the bench and sells the rest for coins', () => {
    const ctx = opened()
    const ids = ctx.state.pendingPack!.playerIds
    const result = decidePack(ctx, ['sign', 'sell', 'sign'])
    expect(result.state.pendingPack).toBeNull()
    expect(result.cards!.map(card => card.id)).toEqual([`${NEW_CARD_PREFIX}0`, `${NEW_CARD_PREFIX}2`])
    expect(result.cards!.map(card => card.playerId)).toEqual([ids[0], ids[2]])
    expect(result.cards!.every(card => card.stars === 1 && card.trained === 0)).toBe(true)
    const sold = config.cards.sellValue[byId.get(ids[1])!.rarity]
    expect(result.state.coins).toBe(sold)
    expect(result.ledger).toEqual([{ currency: 'coins', amount: sold, reason: 'sell', ref: ids[1] }])
    expect(result.extra).toEqual({ signed: 2, sold: 1, coins: sold })
    expect(result.source).toBe('pack')
  })

  it('records every player pulled in the album, even the ones sold', () => {
    const ctx = opened()
    const { state } = decidePack(ctx, ['sell', 'sell', 'sell'])
    expect(new Set(state.album.collected)).toEqual(new Set(ctx.state.pendingPack!.playerIds))
  })

  it('counts signings towards the sign-players goal', () => {
    const goals = [{ id: 'sign', kind: 'signPlayers' as const, target: 3, progress: 0, claimed: false }]
    const ctx = apply(context({ daily: { day: 0, goals, freePackClaimed: false } }), openPack(context({ daily: { day: 0, goals, freePackClaimed: false } }), 'shelf'))
    expect(decidePack(ctx, ['sign', 'sign', 'sell']).state.daily.goals[0].progress).toBe(2)
  })

  it('refuses a full bench, and says how many to sell', () => {
    const base = opened()
    const crowd: OwnedCard[] = Array.from({ length: config.cards.benchSize - 1 }, (_, index) => ({ id: `c${index}`, playerId: 'p001', stars: 1, trained: 0 }))
    const ctx = { ...base, cards: crowd }
    expect(benchCount(crowd, ctx.state.lineup)).toBe(19)
    expect(code(() => decidePack(ctx, ['sign', 'sign', 'sell']))).toBe('bench-full')
    expect(code(() => decidePack(ctx, ['sign', 'sell', 'sell']))).toBe('accepted')
  })

  it('ignores cards in the lineup when counting the bench', () => {
    const base = opened()
    const crowd: OwnedCard[] = Array.from({ length: config.cards.benchSize + 1 }, (_, index) => ({ id: `c${index}`, playerId: 'p001', stars: 1, trained: 0 }))
    const lineup = [crowd[0].id, crowd[1].id, null, null, null]
    const ctx = { ...base, cards: crowd, state: { ...base.state, lineup } }
    // 21 cards, 2 of them playing: 19 on the bench, room for exactly one more.
    expect(code(() => decidePack(ctx, ['sign', 'sell', 'sell']))).toBe('accepted')
    expect(code(() => decidePack(ctx, ['sign', 'sign', 'sell']))).toBe('bench-full')
  })

  it('refuses with nothing pending, the wrong number of choices, or a choice that is neither', () => {
    expect(code(() => decidePack(context(), ['sign', 'sign', 'sign']))).toBe('no-pending')
    expect(code(() => decidePack(opened(), ['sign', 'sign']))).toBe('decisions')
    expect(code(() => decidePack(opened(), ['sign', 'keep', 'sell']))).toBe('decisions')
  })
})

describe('a long run of random actions', () => {
  it('never goes negative, never overfills the bench and always settles a pack before the next', () => {
    for (let run = 0; run < 25; run++) {
      const rng = createRng(`fuzz-${run}`)
      let ctx = context({ coins: 30_000, tokens: 1500 })
      for (let step = 0; step < 120; step++) {
        const now = T0 + step * 3_000_000
        ctx = { ...ctx, now }
        const action = rng.pick(['open', 'open', 'buy', 'arcade', 'star', 'decide', 'decide', 'shelf'] as const)
        try {
          if (action === 'shelf')
            ctx = { ...ctx, state: { ...ctx.state, idle: { ...ctx.state.idle, shelfPacks: ctx.state.idle.shelfPacks + 2 } } }
          else if (action === 'decide')
            ctx = apply(ctx, decidePack(ctx, Array.from({ length: 3 }, () => rng.pick(['sign', 'sell'] as const))))
          else if (action === 'open')
            ctx = apply(ctx, openPack(ctx, 'shelf'))
          else if (action === 'star')
            ctx = apply(ctx, openPack({ ...ctx, state: { ...ctx.state, starPacks: 1 } }, 'star'))
          else if (action === 'buy')
            ctx = apply(ctx, buyPack(ctx))
          else
            ctx = apply(ctx, arcadePack(ctx, rng.pick(['GK', 'DEF', 'MID', 'FWD'] as const)))
          // New cards get real ids, as the database does.
          ctx = { ...ctx, cards: ctx.cards.map((card, index) => (card.id.startsWith(NEW_CARD_PREFIX) ? { ...card, id: `r${run}-${step}-${index}` } : card)) }
        }
        catch (error) {
          if (!isGameRuleError(error))
            throw error
        }
        expect(ctx.state.coins).toBeGreaterThanOrEqual(0)
        expect(ctx.state.tokens).toBeGreaterThanOrEqual(0)
        expect(ctx.state.idle.shelfPacks).toBeGreaterThanOrEqual(0)
        expect(benchCount(ctx.cards, ctx.state.lineup)).toBeLessThanOrEqual(config.cards.benchSize)
      }
    }
  })
})
