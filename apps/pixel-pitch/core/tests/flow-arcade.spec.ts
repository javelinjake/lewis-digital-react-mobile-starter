import type { ClubState, FlowContext } from '../src'
import { describe, expect, it } from 'vitest'
import { collectStadium, collectTray, DEFAULT_CONFIG, finishPlay, finishWarmup, freePlaysLeft, generateCatalogue, isGameRuleError, kickRounds, markerAt, newClubState, pendingStadiumCoins, startPlay, startWarmup, upgradeStadium, warmupBar } from '../src'
import { stadiumStage } from '../src/flow-stadium'
import { newKeepy, stepKeepy } from '../src/minigames'

const config = DEFAULT_CONFIG
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const T0 = Date.UTC(2026, 10, 9, 12)
const catalogue = generateCatalogue(config)
const byId = new Map(catalogue.map(player => [player.id, player]))

function context(patch: (state: ClubState) => ClubState = state => state, now = T0): FlowContext {
  return { state: patch(newClubState(T0, config)), cards: [], catalogue, players: id => byId.get(id), config, clubId: 'club-1', now }
}
const withNow = (ctx: FlowContext, now: number): FlowContext => ({ ...ctx, now })
const apply = (ctx: FlowContext, result: { state: ClubState }): FlowContext => ({ ...ctx, state: result.state })
const code = (run: () => unknown) => {
  try {
    run()
    return 'accepted'
  }
  catch (error) {
    return isGameRuleError(error) ? error.code : 'other'
  }
}

function perfectKickTaps(seed: string) {
  return kickRounds(seed, config).map((bar) => {
    let best = 150
    for (let ms = 150; ms < 4000; ms++) {
      if (Math.abs(markerAt(bar, ms) - bar.centre) < Math.abs(markerAt(bar, best) - bar.centre))
        best = ms
    }
    return best
  })
}

function perfectKeepyTaps(seed: string) {
  let sim = newKeepy(seed)
  const taps: number[] = []
  let was = false
  let wait = -1
  while (!sim.over && sim.step < 7200) {
    const inReach = sim.vy < 0 && sim.y <= config.minigames.keepy.reach
    if (inReach && !was)
      wait = 6
    was = inReach
    let tap = false
    if (wait === 0) {
      tap = true
      wait = -1
    }
    else if (wait > 0) {
      wait--
    }
    if (tap)
      taps.push(sim.step)
    sim = stepKeepy(sim, tap, config)
  }
  return { taps, steps: sim.step }
}

describe('the token trays', () => {
  it('fill at 12 tokens an hour, hold 8 hours, and are emptied into the wallet', () => {
    const ctx = withNow(context(), T0 + 4 * HOUR)
    const { state, ledger, extra } = collectTray(ctx, 'kick')
    expect(extra!.tokens).toBe(48)
    expect(state.tokens).toBe(48)
    expect(state.idle.trayCollectedAt.kick).toBe(T0 + 4 * HOUR)
    expect(state.idle.trayCollectedAt.keepy).toBe(T0)
    expect(ledger).toEqual([{ currency: 'tokens', amount: 48, reason: 'tray', ref: 'kick' }])

    expect(collectTray(withNow(context(), T0 + 3 * DAY), 'keepy').extra!.tokens).toBe(96)
  })

  it('hold 12 hours with the Pass', () => {
    const ctx = withNow(context(state => ({ ...state, idle: { ...state.idle, hasPass: true } })), T0 + 3 * DAY)
    expect(collectTray(ctx, 'kick').extra!.tokens).toBe(144)
  })

  it('refuse an empty tray, and a cabinet that does not exist', () => {
    expect(code(() => collectTray(context(), 'kick'))).toBe('empty')
    expect(code(() => collectTray(withNow(context(), T0 + HOUR), 'pinball' as never))).toBe('cabinet')
  })
})

describe('starting a play', () => {
  it('gives three free plays a day for each cabinet, then none, and starts again the next day', () => {
    let ctx = context()
    for (let play = 0; play < 3; play++) {
      expect(freePlaysLeft(ctx.state, 'kick', config, ctx.now)).toBe(3 - play)
      ctx = apply(ctx, startPlay(ctx, 'kick', false))
      expect(ctx.state.ticket).toMatchObject({ kind: 'kick', paid: false, issuedAt: T0 })
    }
    expect(code(() => startPlay(ctx, 'kick', false))).toBe('no-plays')
    // The other cabinet has its own plays.
    expect(code(() => startPlay(ctx, 'keepy', false))).toBe('accepted')
    expect(code(() => startPlay(withNow(ctx, T0 + DAY), 'kick', false))).toBe('accepted')
  })

  it('gives four free plays with the Pass', () => {
    let ctx = context(state => ({ ...state, idle: { ...state.idle, hasPass: true } }))
    for (let play = 0; play < 4; play++)
      ctx = apply(ctx, startPlay(ctx, 'keepy', false))
    expect(code(() => startPlay(ctx, 'keepy', false))).toBe('no-plays')
  })

  it('sells an extra play for 20 gems, which does not use up a free one', () => {
    let ctx = context(state => ({ ...state, idle: { ...state.idle, gems: 50 } }))
    const paid = startPlay(ctx, 'kick', true)
    expect(paid.state.idle.gems).toBe(30)
    expect(paid.state.ticket).toMatchObject({ paid: true })
    expect(paid.ledger).toEqual([{ currency: 'gems', amount: -20, reason: 'arcade-play', ref: 'kick' }])
    ctx = apply(ctx, paid)
    expect(freePlaysLeft(ctx.state, 'kick', config, ctx.now)).toBe(3)
    expect(code(() => startPlay(context(), 'kick', true))).toBe('gems')
  })

  it('gives every play its own seed', () => {
    let ctx = context()
    const seeds = new Set<string>()
    for (let play = 0; play < 3; play++) {
      ctx = apply(ctx, startPlay(ctx, 'kick', false))
      seeds.add(ctx.state.ticket!.seed)
    }
    expect(seeds.size).toBe(3)
    expect(ctx.state.ticketsIssued).toBe(3)
  })
})

describe('finishing a Kick Timer play', () => {
  const started = () => apply(context(), startPlay(context(), 'kick', false))

  it('pays tokens for the score: a perfect play pays the most', () => {
    const ctx = started()
    const taps = perfectKickTaps(ctx.state.ticket!.seed)
    const done = finishPlay(withNow(ctx, T0 + taps.reduce((sum, tap) => sum + tap, 0) + 5000), 'kick', taps)
    expect(done.extra).toEqual({ score: 15, max: 15, tokens: config.cabinets.playMaxTokens, coins: 0 })
    expect(done.state.tokens).toBe(config.cabinets.playMaxTokens)
    expect(done.state.ticket).toBeNull()
    expect(done.ledger).toEqual([{ currency: 'tokens', amount: config.cabinets.playMaxTokens, reason: 'arcade', ref: 'kick' }])
  })

  it('counts towards the arcade goal and Pass XP', () => {
    const ctx = started()
    const withGoal = { ...ctx, state: { ...ctx.state, daily: { day: 0, goals: [{ id: 'arcade', kind: 'playCabinets' as const, target: 2, progress: 0, claimed: false }], freePackClaimed: false }, pass: { season: 0, xp: 0, claimedFree: [], claimedPremium: [] } } }
    const taps = [500, 500, 500, 500, 500]
    const done = finishPlay(withNow(withGoal, T0 + 10_000), 'kick', taps)
    expect(done.state.daily.goals[0].progress).toBe(1)
    expect(done.state.pass.xp).toBe(config.pass.xp.cabinet)
  })

  it('refuses a play that was faster than its taps allow (a made-up result), and one that took too long', () => {
    const ctx = started()
    const taps = perfectKickTaps(ctx.state.ticket!.seed)
    const total = taps.reduce((sum, tap) => sum + tap, 0)
    expect(code(() => finishPlay(withNow(ctx, T0 + 100), 'kick', taps))).toBe('too-fast')
    expect(code(() => finishPlay(withNow(ctx, T0 + total * config.minigames.clockSlack + 1), 'kick', taps))).toBe('accepted')
    expect(code(() => finishPlay(withNow(ctx, T0 + 11 * 60_000), 'kick', taps))).toBe('expired')
  })

  it('refuses taps that are not a person\'s, the wrong number of them, and a play that was never started', () => {
    const ctx = withNow(started(), T0 + 60_000)
    expect(code(() => finishPlay(ctx, 'kick', [10, 500, 500, 500, 500]))).toBe('taps')
    expect(code(() => finishPlay(ctx, 'kick', [500, 500]))).toBe('taps')
    expect(code(() => finishPlay(ctx, 'kick', [500, 500, 500, 500, Number.NaN]))).toBe('taps')
    expect(code(() => finishPlay(ctx, 'keepy', [8, 20]))).toBe('no-ticket')
    expect(code(() => finishPlay(withNow(context(), T0 + 60_000), 'kick', [500, 500, 500, 500, 500]))).toBe('no-ticket')
  })

  it('can be finished only once: the ticket is spent', () => {
    const ctx = withNow(started(), T0 + 60_000)
    const done = apply(ctx, finishPlay(ctx, 'kick', [500, 500, 500, 500, 500]))
    expect(code(() => finishPlay(done, 'kick', [500, 500, 500, 500, 500]))).toBe('no-ticket')
  })
})

describe('finishing a Keepy-Uppy play', () => {
  it('pays tokens for the kicks, the server replaying the taps', () => {
    const ctx = apply(context(), startPlay(context(), 'keepy', false))
    const { taps, steps } = perfectKeepyTaps(ctx.state.ticket!.seed)
    const done = finishPlay(withNow(ctx, T0 + (steps / 60) * 1000 + 1000), 'keepy', taps)
    expect(done.extra).toEqual({ score: 50, max: 50, tokens: config.cabinets.playMaxTokens, coins: 0 })
  })

  it('pays less for fewer kicks, and nothing for no taps', () => {
    const ctx = apply(context(), startPlay(context(), 'keepy', false))
    const { taps } = perfectKeepyTaps(ctx.state.ticket!.seed)
    const half = finishPlay(withNow(ctx, T0 + 60_000), 'keepy', taps.slice(0, 10))
    expect(half.extra!.score).toBe(10)
    expect(half.extra!.tokens).toBe(Math.floor((config.cabinets.playMaxTokens * 10) / 50))
    expect(finishPlay(withNow(ctx, T0 + 60_000), 'keepy', []).extra).toMatchObject({ score: 0, tokens: 0 })
  })

  it('refuses taps that cannot be a person\'s: too close together, or out of order', () => {
    const ctx = withNow(apply(context(), startPlay(context(), 'keepy', false)), T0 + 60_000)
    expect(code(() => finishPlay(ctx, 'keepy', [20, 22]))).toBe('taps')
    expect(code(() => finishPlay(ctx, 'keepy', [40, 20]))).toBe('taps')
    expect(code(() => finishPlay(ctx, 'keepy', [1.5, 40]))).toBe('taps')
  })

  it('refuses a play whose taps say it took longer than the clock allows', () => {
    const ctx = apply(context(), startPlay(context(), 'keepy', false))
    const { taps, steps } = perfectKeepyTaps(ctx.state.ticket!.seed)
    expect(code(() => finishPlay(withNow(ctx, T0 + 2000), 'keepy', taps))).toBe('too-fast')
    expect(steps).toBeGreaterThan(300)
  })
})

describe('a play bought with gems', () => {
  it('pays coins and Pass XP, never tokens', () => {
    const base = context(state => ({ ...state, idle: { ...state.idle, gems: 40 } }))
    const ctx = apply(base, startPlay(base, 'kick', true))
    const taps = perfectKickTaps(ctx.state.ticket!.seed)
    const done = finishPlay(withNow(ctx, T0 + 60_000), 'kick', taps)
    expect(done.extra).toEqual({ score: 15, max: 15, tokens: 0, coins: config.cabinets.gemPlayCoins })
    expect(done.state.tokens).toBe(0)
    expect(done.state.coins).toBe(config.cabinets.gemPlayCoins)
    expect(done.ledger!.some(entry => entry.currency === 'tokens')).toBe(false)
  })
})

describe('the warm-up kick', () => {
  it('gives one try for each match, and a bonus for the next match from the zone hit', () => {
    const ctx = apply(context(), startWarmup(context()))
    expect(ctx.state.ticket).toMatchObject({ kind: 'warmup' })
    expect(code(() => startWarmup(ctx))).toBe('warmup-used')

    const bar = warmupBar(ctx.state.ticket!.seed, config)
    let best = 150
    for (let ms = 150; ms < 4000; ms++) {
      if (Math.abs(markerAt(bar, ms) - bar.centre) < Math.abs(markerAt(bar, best) - bar.centre))
        best = ms
    }
    const finished = finishWarmup(withNow(ctx, T0 + best + 1000), best)
    expect(finished.extra).toEqual({ zone: 'gold', bonus: config.match.warmupGold })
    expect(finished.state.league.warmupBonus).toBe(config.match.warmupGold)
    expect(finished.state.ticket).toBeNull()
  })

  it('may be tried again for the next match', () => {
    const started = apply(context(), startWarmup(context()))
    const next = { ...started, state: { ...started.state, league: { ...started.state.league, fixtureNo: started.state.league.fixtureNo + 1 } } }
    expect(code(() => startWarmup(next))).toBe('accepted')
  })

  it('refuses a result with no warm-up started, a made-up tap time, or a result faster than the clock', () => {
    expect(code(() => finishWarmup(withNow(context(), T0 + 5000), 2000))).toBe('no-ticket')
    const ctx = apply(context(), startWarmup(context()))
    expect(code(() => finishWarmup(withNow(ctx, T0 + 5000), -5))).toBe('taps')
    expect(code(() => finishWarmup(withNow(ctx, T0 + 100), 2000))).toBe('too-fast')
  })
})

describe('the stadium', () => {
  it('fills at the level\'s rate, holds 8 hours, and is collected into the wallet', () => {
    const ctx = withNow(context(), T0 + 2 * HOUR)
    expect(pendingStadiumCoins(ctx.state.idle, config, ctx.now)).toBe(config.stadium.coinsPerHour[0] * 2)
    const done = collectStadium(ctx)
    expect(done.extra!.coins).toBe(config.stadium.coinsPerHour[0] * 2)
    expect(done.state.coins).toBe(config.stadium.coinsPerHour[0] * 2)
    expect(done.state.idle.stadiumCollectedAt).toBe(ctx.now)
    expect(collectStadium(withNow(context(), T0 + 3 * DAY)).extra!.coins).toBe(config.stadium.coinsPerHour[0] * 8)
    expect(code(() => collectStadium(context()))).toBe('empty')
  })

  it('counts towards the stadium goal', () => {
    const ctx = withNow(context(state => ({ ...state, daily: { day: 0, goals: [{ id: 'stadium', kind: 'collectStadium', target: 1, progress: 0, claimed: false }], freePackClaimed: false } })), T0 + HOUR)
    expect(collectStadium(ctx).state.daily.goals[0].progress).toBe(1)
  })

  it('upgrades a level at a time for its price, collecting the pile first', () => {
    const rich = withNow(context(state => ({ ...state, coins: config.stadium.upgradeCost[0] })), T0 + 2 * HOUR)
    const done = upgradeStadium(rich)
    expect(done.state.idle.stadiumLevel).toBe(2)
    expect(done.extra).toEqual({ level: 2, cost: config.stadium.upgradeCost[0] })
    // The pile of 120 coins was collected, then the price paid.
    expect(done.state.coins).toBe(config.stadium.coinsPerHour[0] * 2)
    expect(done.state.idle.stadiumCollectedAt).toBe(rich.now)
    expect(done.ledger).toHaveLength(2)
  })

  it('can be paid for with the pile it has collected', () => {
    const exact = withNow(context(state => ({ ...state, coins: config.stadium.upgradeCost[0] - 100 })), T0 + 2 * HOUR)
    expect(code(() => upgradeStadium(exact))).toBe('accepted')
    expect(code(() => upgradeStadium(withNow(context(state => ({ ...state, coins: 10 })), T0 + HOUR)))).toBe('coins')
  })

  it('stops at level 10, and shows a bigger stadium at levels 4 and 8', () => {
    const top = context(state => ({ ...state, coins: 1_000_000, idle: { ...state.idle, stadiumLevel: config.stadium.coinsPerHour.length } }))
    expect(code(() => upgradeStadium(top))).toBe('max-level')
    expect([1, 3, 4, 7, 8, 10].map(stadiumStage)).toEqual([1, 1, 2, 2, 3, 3])
  })
})
