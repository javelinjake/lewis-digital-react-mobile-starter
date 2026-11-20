import type { ClubState, FlowContext } from '../src'
import { describe, expect, it } from 'vitest'
import { addXp, albumSets, claimAlbumSet, claimCalendar, claimFreePack, claimGoal, claimPassTier, DEFAULT_CONFIG, generateCatalogue, grantReward, isGameRuleError, maxXp, newClubState, nextCalendarDay, pickGoals, recordProgress, rollDaily, rollSeason, seasonOf, tierReached } from '../src'

const config = DEFAULT_CONFIG
const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 9, 12)
const day0 = Math.floor(T0 / DAY)
const catalogue = generateCatalogue(config)
const byId = new Map(catalogue.map(player => [player.id, player]))

const context = (patch: (state: ClubState) => ClubState = state => state, now = T0): FlowContext => ({
  state: patch(rollDaily(rollSeason(newClubState(T0, config), T0, config), T0, 'club-1', config)),
  cards: [],
  catalogue,
  players: id => byId.get(id),
  config,
  clubId: 'club-1',
  now,
})
const code = (run: () => unknown) => {
  try {
    run()
    return 'accepted'
  }
  catch (error) {
    return isGameRuleError(error) ? error.code : 'other'
  }
}

describe('daily goals', () => {
  it('are three, of different kinds, the same all day for a club, and different on another day or club', () => {
    const goals = pickGoals('club-1', day0, config)
    expect(goals).toHaveLength(3)
    expect(new Set(goals.map(goal => goal.kind)).size).toBe(3)
    expect(pickGoals('club-1', day0, config)).toEqual(goals)
    const variety = new Set(Array.from({ length: 30 }, (_, day) => pickGoals('club-1', day, config).map(goal => goal.id).sort().join()))
    expect(variety.size).toBeGreaterThan(5)
    expect(new Set(Array.from({ length: 30 }, (_, club) => pickGoals(`club-${club}`, day0, config).map(goal => goal.id).join())).size).toBeGreaterThan(5)
  })

  it('start fresh each day and leave the rest of the day alone', () => {
    const ctx = context()
    expect(ctx.state.daily).toMatchObject({ day: day0, freePackClaimed: false })
    const same = rollDaily(ctx.state, T0 + 3_600_000, 'club-1', config)
    expect(same).toBe(ctx.state)
    const tomorrow = rollDaily({ ...ctx.state, daily: { ...ctx.state.daily, freePackClaimed: true } }, T0 + DAY, 'club-1', config)
    expect(tomorrow.daily.day).toBe(day0 + 1)
    expect(tomorrow.daily.freePackClaimed).toBe(false)
    expect(tomorrow.daily.goals.every(goal => goal.progress === 0 && !goal.claimed)).toBe(true)
  })

  it('count progress up to the target and ignore a kind that is not among them', () => {
    let state = context().state
    const goal = state.daily.goals[0]
    for (let n = 0; n < goal.target + 3; n++)
      state = recordProgress(state, goal.kind)
    expect(state.daily.goals[0].progress).toBe(goal.target)
    const absent = config.daily.goals.find(entry => !state.daily.goals.some(g => g.kind === entry.kind))!
    expect(recordProgress(state, absent.kind)).toBe(state)
  })

  it('pay their reward and Pass XP once, when done', () => {
    let ctx = context()
    const goal = ctx.state.daily.goals[0]
    expect(code(() => claimGoal(ctx, goal.id))).toBe('unfinished')
    ctx = { ...ctx, state: { ...ctx.state, daily: { ...ctx.state.daily, goals: ctx.state.daily.goals.map((entry, index) => (index === 0 ? { ...entry, progress: entry.target } : entry)) } } }
    const definition = config.daily.goals.find(entry => entry.id === goal.id)!
    const claimed = claimGoal(ctx, goal.id)
    expect(claimed.extra!.reward).toEqual(definition.reward)
    expect(claimed.state.pass.xp).toBe(config.pass.xp.goal)
    expect(claimed.state.daily.goals[0].claimed).toBe(true)
    expect(code(() => claimGoal({ ...ctx, state: claimed.state }, goal.id))).toBe('claimed')
    expect(code(() => claimGoal(ctx, 'not-a-goal'))).toBe('no-goal')
  })
})

describe('the daily free pack', () => {
  it('puts a pack on the shelf once a day, even when the shelf is full', () => {
    const full = context(state => ({ ...state, idle: { ...state.idle, shelfPacks: config.shelf.capacity } }))
    const done = claimFreePack(full)
    expect(done.state.idle.shelfPacks).toBe(config.shelf.capacity + 1)
    expect(code(() => claimFreePack({ ...full, state: done.state }))).toBe('claimed')
    const tomorrow = { ...full, state: rollDaily(done.state, T0 + DAY, 'club-1', config), now: T0 + DAY }
    expect(code(() => claimFreePack(tomorrow))).toBe('accepted')
  })
})

describe('the login calendar', () => {
  it('pays the next reward for each day in a row, ending in a Star pack on day 7', () => {
    let ctx = context()
    for (let day = 1; day <= 7; day++) {
      ctx = { ...ctx, now: T0 + (day - 1) * DAY }
      const claimed = claimCalendar(ctx)
      expect(claimed.extra).toMatchObject({ day, reward: config.calendar.rewards[day - 1] })
      ctx = { ...ctx, state: claimed.state }
    }
    expect(ctx.state.starPacks).toBe(1)
    expect(config.calendar.rewards[6].kind).toBe('starPacks')
  })

  it('can be claimed once a day, starts again after a missed day, and again after day 7', () => {
    const first = claimCalendar(context())
    const ctx = { ...context(), state: first.state }
    expect(code(() => claimCalendar(ctx))).toBe('claimed')
    expect(nextCalendarDay({ streak: 3, lastClaimDay: day0 }, day0 + 1)).toBe(4)
    expect(nextCalendarDay({ streak: 3, lastClaimDay: day0 }, day0 + 2)).toBe(1)
    expect(nextCalendarDay({ streak: 7, lastClaimDay: day0 }, day0 + 1)).toBe(1)
    expect(nextCalendarDay({ streak: 2, lastClaimDay: day0 }, day0)).toBeNull()
    expect(claimCalendar({ ...ctx, now: T0 + 3 * DAY }).extra!.day).toBe(1)
  })
})

describe('the League Pass', () => {
  const withXp = (xp: number, hasPass = false) => context(state => ({ ...state, pass: { ...state.pass, xp }, idle: { ...state.idle, hasPass } }))

  it('has 30 tiers, 100 XP each, and the free track pays 15 of them, ending in a Star pack', () => {
    expect(config.pass.premium).toHaveLength(30)
    expect(config.pass.free).toHaveLength(30)
    expect(config.pass.free.filter(Boolean)).toHaveLength(15)
    expect(config.pass.free[29]).toEqual({ kind: 'starPacks', amount: 1 })
    expect(config.pass.premium.filter(reward => reward.kind === 'starPacks')).toHaveLength(2)
    expect(maxXp(config)).toBe(3000)
  })

  it('counts the tiers reached from XP, and stops at the top', () => {
    expect([0, 99, 100, 250, 2999, 3000].map(xp => tierReached(withXp(xp).state, config))).toEqual([0, 0, 1, 2, 29, 30])
    expect(addXp(withXp(2990).state, 500, config).pass.xp).toBe(3000)
  })

  it('pays a free tier once it is reached, and not before', () => {
    const tierWithReward = config.pass.free.findIndex(Boolean) + 1
    expect(code(() => claimPassTier(withXp(0), 'free', tierWithReward))).toBe('locked')
    const ctx = withXp(tierWithReward * 100)
    const done = claimPassTier(ctx, 'free', tierWithReward)
    expect(done.extra!.reward).toEqual(config.pass.free[tierWithReward - 1])
    expect(code(() => claimPassTier({ ...ctx, state: done.state }, 'free', tierWithReward))).toBe('claimed')
    const empty = config.pass.free.findIndex(reward => reward === null) + 1
    expect(code(() => claimPassTier(withXp(3000), 'free', empty))).toBe('no-reward')
  })

  it('keeps the premium track for the League Pass, which unlocks every tier already reached', () => {
    expect(code(() => claimPassTier(withXp(1500), 'premium', 3))).toBe('no-pass')
    let ctx = withXp(1500, true)
    for (let tier = 1; tier <= 15; tier++) {
      const claimed = claimPassTier(ctx, 'premium', tier)
      ctx = { ...ctx, state: claimed.state }
    }
    expect(ctx.state.pass.claimedPremium).toHaveLength(15)
    expect(ctx.state.starPacks).toBe(1)
    expect(code(() => claimPassTier(ctx, 'premium', 16))).toBe('locked')
  })

  it('refuses a made-up tier or track', () => {
    expect(code(() => claimPassTier(withXp(3000, true), 'premium', 31))).toBe('tier')
    expect(code(() => claimPassTier(withXp(3000, true), 'premium', 0))).toBe('tier')
    expect(code(() => claimPassTier(withXp(3000, true), 'gold' as never, 1))).toBe('track')
  })

  it('runs for four weeks, and a new season starts the track again', () => {
    expect(seasonOf(T0, config)).toBe(Math.floor(day0 / 28))
    const ctx = withXp(1200, true)
    const claimed = claimPassTier(ctx, 'premium', 1)
    const same = rollSeason(claimed.state, T0 + DAY, config)
    expect(same.pass.xp).toBe(1200)
    const later = rollSeason(claimed.state, T0 + 28 * DAY, config)
    expect(later.pass).toEqual({ season: seasonOf(T0 + 28 * DAY, config), xp: 0, claimedFree: [], claimedPremium: [] })
  })
})

describe('rewards', () => {
  it('go to the right place: coins, gems and tokens to the wallet, packs to the shelf, Star packs to the store', () => {
    const base = context().state
    expect(grantReward(base, { kind: 'coins', amount: 100 }, 'x').state.coins).toBe(100)
    expect(grantReward(base, { kind: 'gems', amount: 5 }, 'x').state.idle.gems).toBe(5)
    expect(grantReward(base, { kind: 'tokens', amount: 7 }, 'x').state.tokens).toBe(7)
    expect(grantReward(base, { kind: 'packs', amount: 2 }, 'x').state.idle.shelfPacks).toBe(2)
    expect(grantReward(base, { kind: 'starPacks', amount: 1 }, 'x').state.starPacks).toBe(1)
    expect(grantReward(base, { kind: 'coins', amount: 100 }, 'goal', 'rip').ledger).toEqual([{ currency: 'coins', amount: 100, reason: 'goal', ref: 'rip' }])
  })
})

describe('the album', () => {
  const sets = albumSets(catalogue, config)

  it('has sets of six players, each of one nation and one position, no player in two', () => {
    expect(sets.length).toBeGreaterThan(20)
    const seen = new Set<string>()
    for (const set of sets) {
      expect(set.playerIds).toHaveLength(6)
      for (const id of set.playerIds) {
        const player = byId.get(id)!
        expect(player.nation).toBe(set.nation)
        expect(player.position).toBe(set.position)
        expect(seen.has(id)).toBe(false)
        seen.add(id)
      }
    }
    expect(new Set(sets.map(set => set.id)).size).toBe(sets.length)
  })

  it('mixes the top and the bottom of a group in every set, so no set is all legends', () => {
    const spread = sets.map((set) => {
      const ratings = set.playerIds.map(id => byId.get(id)!.rating)
      return Math.max(...ratings) - Math.min(...ratings)
    })
    expect(Math.min(...spread)).toBeGreaterThan(5)
  })

  it('is the same every time for a catalogue', () => {
    expect(albumSets(catalogue, config)).toBe(sets)
    expect(albumSets([...catalogue], config)).toEqual(sets)
  })

  it('pays a finished set once, and not an unfinished one', () => {
    const set = sets[0]
    const unfinished = context()
    expect(code(() => claimAlbumSet(unfinished, set.id))).toBe('unfinished')
    const finished = context(state => ({ ...state, album: { collected: set.playerIds, completed: 1, claimed: [] } }))
    const done = claimAlbumSet(finished, set.id)
    expect(done.extra!.reward).toEqual(config.album.reward)
    expect(done.state.idle.shelfPacks).toBe(1)
    expect(code(() => claimAlbumSet({ ...finished, state: done.state }, set.id))).toBe('claimed')
    expect(code(() => claimAlbumSet(finished, 'nowhere-fwd-9'))).toBe('no-set')
  })
})
