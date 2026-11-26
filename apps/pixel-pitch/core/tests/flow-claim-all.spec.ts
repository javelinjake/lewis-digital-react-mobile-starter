import type { ClubState, FlowContext } from '../src'
import { describe, expect, it } from 'vitest'
import { albumSets, claimAll, claimAlbumSet, claimFreePack, claimGoal, claimPassTier, collectStadium, collectTray, DEFAULT_CONFIG, generateCatalogue, isGameRuleError, newClubState, nextCalendarDay, rollDaily, rollSeason, tierReached, waitingToClaim } from '../src'

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
  it('lists everything waiting; claim all takes the idle rewards and leaves goals and Pass tiers for their screens', () => {
    const ctx = busy()
    const waiting = waitingToClaim({ ...ctx })
    expect(waiting.stadiumCoins).toBeGreaterThan(0)
    expect(waiting.trayTokens).toBeGreaterThan(0)
    expect(waiting).toMatchObject({ calendarDay: 1, freePack: true, goals: 1, albumSets: 1 })
    expect(waiting.passTiers).toBeGreaterThan(0)
    const after = waitingToClaim({ ...ctx, state: claimAll(ctx).state })
    expect(after).toMatchObject({ stadiumCoins: 0, trayTokens: 0, calendarDay: 1, freePack: false, albumSets: 0 })
    // Collecting the stadium finishes the stadium goal too, so there is at least as much to claim on Goals as before.
    expect(after.goals).toBeGreaterThanOrEqual(1)
    expect(after.passTiers).toBe(waiting.passTiers)
  })

  it('has nothing waiting for a brand new club except the calendar and the free pack', () => {
    expect(waitingToClaim(context())).toMatchObject({ stadiumCoins: 0, trayTokens: 0, calendarDay: 1, freePack: true, goals: 0, passTiers: 0, albumSets: 0 })
  })
})

describe('claim all', () => {
  it('takes the idle rewards in one go: the same state as each claim one after another', () => {
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
    then(claimFreePack(by))
    then(claimAlbumSet(by, set.id))

    const all = claimAll(ctx)
    expect(all.state).toEqual(by.state)
    expect(all.ledger).toEqual(results.flatMap(result => result.ledger ?? []))
    // The stadium, the tray, the free pack and the album set; not the login streak's day.
    expect(all.extra!.items).toBe(4)
    expect(nextCalendarDay(all.state.calendar, 0)).toBe(1)
    // No goal and no Pass tier was claimed.
    expect(all.state.daily.goals.some(goal => goal.claimed)).toBe(false)
    expect(all.state.pass.claimedFree).toEqual([])
  })

  it('still lets a goal and a Pass tier be claimed on their own afterwards', () => {
    const ctx = busy()
    const all = claimAll(ctx)
    const goal = all.state.daily.goals.find(entry => entry.progress >= entry.target)!
    expect(code(() => claimGoal({ ...ctx, state: all.state }, goal.id))).toBe('accepted')
    expect(tierReached(all.state, config)).toBeGreaterThan(0)
    // The free track pays every second tier.
    expect(tierReached(all.state, config)).toBeGreaterThanOrEqual(2)
    expect(code(() => claimPassTier({ ...ctx, state: all.state }, 'free', 2))).toBe('accepted')
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
    // A brand new club has its free pack to take (the login streak's day waits for the Goals screen), then nothing.
    const fresh = context()
    const first = claimAll(fresh)
    expect(first.extra!.items).toBe(1)
    expect(code(() => claimAll({ ...fresh, state: first.state }))).toBe('nothing')
  })

  it('counts what it collects towards goals, which are then ready to claim on the Goals screen', () => {
    const ctx = context((state) => {
      const others = state.daily.goals.filter(goal => goal.kind !== 'collectStadium').slice(0, 2)
      const goals = [{ id: 'stadium', kind: 'collectStadium' as const, target: 1, progress: 0, claimed: false }, ...others]
      return { ...state, daily: { ...state.daily, goals } }
    }, T0 + 3 * HOUR)
    const all = claimAll(ctx)
    expect(all.state.daily.goals[0]).toMatchObject({ progress: 1, claimed: false })
  })

  it('leaves the League Pass alone, premium track or not', () => {
    const withXp = (hasPass: boolean) => context(state => ({ ...state, idle: { ...state.idle, hasPass }, pass: { ...state.pass, xp: config.pass.xpPerTier * 3 } }))
    expect(claimAll(withXp(false)).state.pass).toMatchObject({ claimedFree: [], claimedPremium: [] })
    expect(claimAll(withXp(true)).state.pass).toMatchObject({ claimedFree: [], claimedPremium: [] })
  })
})
