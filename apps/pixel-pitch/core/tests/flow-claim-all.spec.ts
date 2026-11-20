import type { ClubState, FlowContext } from '../src'
import { describe, expect, it } from 'vitest'
import { albumSets, claimAll, claimAlbumSet, claimCalendar, claimFreePack, claimGoal, claimPassTier, collectStadium, collectTray, DEFAULT_CONFIG, generateCatalogue, isGameRuleError, newClubState, rollDaily, rollSeason, tierReached, waitingToClaim } from '../src'

const config = DEFAULT_CONFIG
const HOUR = 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 9, 12)
const catalogue = generateCatalogue(config)
const byId = new Map(catalogue.map(player => [player.id, player]))

function context(patch: (state: ClubState) => ClubState = state => state, now = T0): FlowContext {
  const fresh = rollDaily(rollSeason(newClubState(T0, config), T0, config), T0, 'club-1', config)
  return { state: patch(fresh), cards: [], catalogue, players: id => byId.get(id), config, clubId: 'club-1', now }
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

/** A club with something of everything waiting: a pile in the stadium and the tray, a finished goal, a Pass tier and an album set. */
function busy(): FlowContext {
  const set = albumSets(catalogue, config)[0]
  return context((state) => {
    const goals = state.daily.goals.map((goal, index) => (index === 0 ? { ...goal, progress: goal.target } : goal))
    return {
      ...state,
      daily: { ...state.daily, goals },
      pass: { ...state.pass, xp: config.pass.xpPerTier * 2 },
      album: { ...state.album, collected: [...state.album.collected, ...set.playerIds] },
    }
  }, T0 + 5 * HOUR)
}

describe('what is waiting', () => {
  it('lists what claim all would take: the same things, counted', () => {
    const ctx = busy()
    const waiting = waitingToClaim({ ...ctx })
    expect(waiting.stadiumCoins).toBeGreaterThan(0)
    expect(waiting.trayTokens).toBeGreaterThan(0)
    expect(waiting).toMatchObject({ calendarDay: 1, freePack: true, goals: 1, albumSets: 1 })
    expect(waiting.passTiers).toBeGreaterThan(0)
    // After claiming all, nothing is waiting.
    const after = claimAll(ctx)
    expect(waitingToClaim({ ...ctx, state: after.state })).toEqual({ stadiumCoins: 0, trayTokens: 0, calendarDay: null, freePack: false, goals: 0, passTiers: 0, albumSets: 0 })
  })

  it('has nothing waiting for a brand new club except the calendar and the free pack', () => {
    expect(waitingToClaim(context())).toMatchObject({ stadiumCoins: 0, trayTokens: 0, calendarDay: 1, freePack: true, goals: 0, passTiers: 0, albumSets: 0 })
  })
})

describe('claim all', () => {
  it('takes everything waiting in one go: the same state as each claim one after another', () => {
    const ctx = busy()
    const set = albumSets(catalogue, config)[0]

    // The same claims by hand, in the same order. Collecting the stadium finishes the stadium goal, so that is claimed too.
    let by = ctx
    const results: Array<{ state: ClubState, ledger?: unknown[] }> = []
    const then = (result: { state: ClubState, ledger?: unknown[] }) => {
      by = { ...by, state: result.state }
      results.push(result)
    }
    then(collectStadium(by))
    then(collectTray(by))
    then(claimCalendar(by))
    then(claimFreePack(by))
    for (const goal of by.state.daily.goals) {
      if (goal.progress >= goal.target && !goal.claimed)
        then(claimGoal(by, goal.id))
    }
    const goalsClaimed = by.state.daily.goals.filter(goal => goal.claimed).length
    for (let tier = 1; tier <= tierReached(by.state, config); tier++) {
      if (config.pass.free[tier - 1])
        then(claimPassTier(by, 'free', tier))
    }
    then(claimAlbumSet(by, set.id))

    const all = claimAll(ctx)
    expect(all.state).toEqual(by.state)
    expect(all.ledger).toEqual(results.flatMap(result => result.ledger ?? []))
    // The stadium, the tray, the calendar day, the free pack, each finished goal, each Pass tier and the album set.
    expect(all.extra!.items).toBe(results.length)
    expect(goalsClaimed).toBeGreaterThanOrEqual(2)
    expect(results.length).toBeGreaterThan(7)
  })

  it('reports what the wallet gained, so the pop-up can say so', () => {
    const ctx = busy()
    const all = claimAll(ctx)
    const { state } = all
    expect(all.extra).toMatchObject({
      coins: state.coins - ctx.state.coins,
      gems: state.idle.gems - ctx.state.idle.gems,
      tokens: state.tokens - ctx.state.tokens,
      packs: state.idle.shelfPacks - ctx.state.idle.shelfPacks,
      starPacks: state.starPacks - ctx.state.starPacks,
    })
    expect(all.extra!.coins).toBeGreaterThan(0)
    expect(all.extra!.tokens).toBeGreaterThan(0)
    expect(all.extra!.packs).toBeGreaterThan(0)
  })

  it('writes a ledger row for every change, so the wallet always adds up', () => {
    const ctx = busy()
    const all = claimAll(ctx)
    const sum = (currency: string) => (all.ledger ?? []).filter(entry => entry.currency === currency).reduce((total, entry) => total + entry.amount, 0)
    expect(sum('coins')).toBe(all.state.coins - ctx.state.coins)
    expect(sum('gems')).toBe(all.state.idle.gems - ctx.state.idle.gems)
    expect(sum('tokens')).toBe(all.state.tokens - ctx.state.tokens)
  })

  it('leaves nothing to claim: a second go is refused, and so is a club with nothing waiting', () => {
    const done = claimAll(busy())
    expect(code(() => claimAll({ ...busy(), state: done.state }))).toBe('nothing')
    // A brand new club still has the calendar and the free pack, but after taking them there is nothing left.
    const fresh = context()
    const first = claimAll(fresh)
    expect(first.extra!.items).toBe(2)
    expect(code(() => claimAll({ ...fresh, state: first.state }))).toBe('nothing')
  })

  it('lets one claim finish the next: collecting the stadium counts towards a goal that is claimed in the same go', () => {
    const ctx = context((state) => {
      const others = state.daily.goals.filter(goal => goal.kind !== 'collectStadium').slice(0, 2)
      const goals = [{ id: 'stadium', kind: 'collectStadium' as const, target: 1, progress: 0, claimed: false }, ...others]
      return { ...state, daily: { ...state.daily, goals } }
    }, T0 + 3 * HOUR)
    const all = claimAll(ctx)
    expect(all.state.daily.goals[0]).toMatchObject({ progress: 1, claimed: true })
  })

  it('claims the premium track too when the Pass is held, and only then', () => {
    const withXp = (hasPass: boolean) => context(state => ({ ...state, idle: { ...state.idle, hasPass }, pass: { ...state.pass, xp: config.pass.xpPerTier * 3 } }))
    expect(claimAll(withXp(false)).state.pass.claimedPremium).toEqual([])
    expect(claimAll(withXp(true)).state.pass.claimedPremium).toEqual([1, 2, 3])
  })
})
