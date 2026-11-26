import type { ClubState, FlowContext } from '../src'
import { describe, expect, it } from 'vitest'
import { CABINETS, collectStadium, collectTray, DEFAULT_CONFIG, energyAt, finishPlay, finishWarmup, generateCatalogue, hotCabinet, isGameRuleError, keepyMax, newClubState, pendingStadiumCoins, startPlay, startWarmup, upgradeStadium, warmupBar } from '../src'
import { stadiumStage } from '../src/flow-stadium'
import { cabinetMax, markerAt, perfectTaps, runKeepy } from '../src'

/** Payout tests run with no hot cabinet, so a play pays the plain amount; the hot cabinet has its own test. */
const config = { ...DEFAULT_CONFIG, cabinets: { ...DEFAULT_CONFIG.cabinets, hotBonus: 0 } }
const MINUTE = 60_000
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

const perfectKickTaps = (seed: string) => perfectTaps('kick', seed, config)
const perfectPenaltyTaps = (seed: string) => perfectTaps('pens', seed, config)
/** A perfect Keepy-Uppy play's taps, and how many 60 Hz steps it lasts. */
function perfectKeepyTaps(seed: string) {
  const taps = perfectTaps('keepy', seed, config)
  return { taps, steps: runKeepy(seed, taps, config).steps }
}

describe('the token tray', () => {
  it('fills at 24 tokens an hour, holds 8 hours, and is emptied into the wallet', () => {
    const ctx = withNow(context(), T0 + 4 * HOUR)
    const { state, ledger, extra } = collectTray(ctx)
    expect(extra!.tokens).toBe(96)
    expect(state.tokens).toBe(96)
    expect(state.idle.trayCollectedAt).toBe(T0 + 4 * HOUR)
    expect(ledger).toEqual([{ currency: 'tokens', amount: 96, reason: 'tray', ref: 'arcade' }])

    expect(collectTray(withNow(context(), T0 + 3 * DAY)).extra!.tokens).toBe(192)
  })

  it('holds 12 hours with the Pass', () => {
    const ctx = withNow(context(state => ({ ...state, idle: { ...state.idle, hasPass: true } })), T0 + 3 * DAY)
    expect(collectTray(ctx).extra!.tokens).toBe(288)
  })

  it('refuses an empty tray', () => {
    expect(code(() => collectTray(context()))).toBe('empty')
  })
})

describe('starting a play', () => {
  it('costs one energy from the one bar every cabinet shares: five plays, then none', () => {
    let ctx = context()
    expect(energyAt(ctx.state, config, ctx.now)).toBe(5)
    const games = ['kick', 'keepy', 'kick', 'keepy', 'kick'] as const
    for (const [play, game] of games.entries()) {
      expect(energyAt(ctx.state, config, ctx.now)).toBe(5 - play)
      ctx = apply(ctx, startPlay(ctx, game, false))
      expect(ctx.state.ticket).toMatchObject({ kind: game, paid: false, issuedAt: T0 })
    }
    expect(energyAt(ctx.state, config, ctx.now)).toBe(0)
    // Out for both cabinets, not just the one just played.
    expect(code(() => startPlay(ctx, 'kick', false))).toBe('no-energy')
    expect(code(() => startPlay(ctx, 'keepy', false))).toBe('no-energy')
  })

  it('gets one back every 90 minutes, on the server clock', () => {
    let ctx = context()
    for (let play = 0; play < 5; play++)
      ctx = apply(ctx, startPlay(ctx, 'kick', false))
    expect(code(() => startPlay(withNow(ctx, T0 + 89 * MINUTE), 'kick', false))).toBe('no-energy')
    expect(code(() => startPlay(withNow(ctx, T0 + 90 * MINUTE), 'kick', false))).toBe('accepted')
    // Two back after three hours, all five after seven and a half.
    expect(energyAt(ctx.state, config, T0 + 180 * MINUTE)).toBe(2)
    expect(energyAt(ctx.state, config, T0 + 450 * MINUTE)).toBe(5)
    expect(energyAt(ctx.state, config, T0 + 30 * DAY)).toBe(5)
  })

  it('holds six with the Pass', () => {
    let ctx = context(state => ({ ...state, idle: { ...state.idle, hasPass: true } }))
    expect(energyAt(ctx.state, config, ctx.now)).toBe(6)
    for (let play = 0; play < 6; play++)
      ctx = apply(ctx, startPlay(ctx, 'keepy', false))
    expect(code(() => startPlay(ctx, 'keepy', false))).toBe('no-energy')
  })

  it('sells an extra play for 20 gems, which does not use any energy', () => {
    let ctx = context(state => ({ ...state, idle: { ...state.idle, gems: 50 } }))
    const paid = startPlay(ctx, 'kick', true)
    expect(paid.state.idle.gems).toBe(30)
    expect(paid.state.ticket).toMatchObject({ paid: true })
    expect(paid.ledger).toEqual([{ currency: 'gems', amount: -20, reason: 'arcade-play', ref: 'kick' }])
    ctx = apply(ctx, paid)
    expect(energyAt(ctx.state, config, ctx.now)).toBe(5)
    expect(code(() => startPlay(context(), 'kick', true))).toBe('gems')
  })

  it('refuses a cabinet that does not exist', () => {
    expect(code(() => startPlay(context(), 'pinball' as never, false))).toBe('cabinet')
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

describe('the cabinet of the day', () => {
  it('takes turns, a day each, through every cabinet', () => {
    const days = Array.from({ length: CABINETS.length * 3 }, (_, day) => hotCabinet(T0 + day * DAY, config))
    expect(new Set(days)).toEqual(new Set(CABINETS))
    for (let day = 0; day < days.length - CABINETS.length; day++)
      expect(days[day + CABINETS.length]).toBe(days[day])
    expect(days[0]).not.toBe(days[1])
  })

  it('pays 50% more tokens than a normal day, and only for a free play', () => {
    const live = { ...DEFAULT_CONFIG }
    const hot = hotCabinet(T0, live)
    const cold = CABINETS.find(cabinet => cabinet !== hot)!
    const play = (cabinet: typeof hot) => {
      const base = { ...context(), config: live }
      const started = { ...base, state: startPlay(base, cabinet, false).state }
      return finishPlay(withNow(started, T0 + 60_000), cabinet, perfectTaps(cabinet, started.state.ticket!.seed, live))
    }
    expect(play(cold).extra!.tokens).toBe(live.cabinets.playMaxTokens)
    expect(play(hot).extra).toMatchObject({ hot: true, tokens: Math.floor(live.cabinets.playMaxTokens * 1.5) })
    expect(play(cold).extra).toMatchObject({ hot: false })
  })
})

describe('finishing a Kick Timer play', () => {
  const started = () => apply(context(), startPlay(context(), 'kick', false))

  it('pays tokens for the score: a perfect play pays the most', () => {
    const ctx = started()
    const taps = perfectKickTaps(ctx.state.ticket!.seed)
    const done = finishPlay(withNow(ctx, T0 + taps.reduce((sum, tap) => sum + tap, 0) + 5000), 'kick', taps)
    expect(done.extra).toEqual({ score: 27, max: 27, tokens: config.cabinets.playMaxTokens, coins: 0, previousBest: 0, newBest: true, hot: hotCabinet(T0, config) === 'kick' })
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
    expect(code(() => finishPlay(ctx, 'keepy', []))).toBe('no-ticket')
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
    expect(done.extra).toMatchObject({ score: keepyMax(config), max: keepyMax(config), tokens: config.cabinets.playMaxTokens, coins: 0 })
  })

  it('pays less for fewer kicks, and nothing for no taps', () => {
    const ctx = apply(context(), startPlay(context(), 'keepy', false))
    const { taps } = perfectKeepyTaps(ctx.state.ticket!.seed)
    const half = finishPlay(withNow(ctx, T0 + 60_000), 'keepy', taps.slice(0, 10))
    // Ten kicks, the tenth golden: 11 points of 33.
    expect(half.extra!.score).toBe(11)
    expect(half.extra!.tokens).toBe(Math.floor((config.cabinets.playMaxTokens * 11) / 33))
    expect(finishPlay(withNow(ctx, T0 + 60_000), 'keepy', []).extra).toMatchObject({ score: 0, tokens: 0 })
  })

  it('refuses taps that cannot be a person\'s: too close together, or out of order', () => {
    const ctx = withNow(apply(context(), startPlay(context(), 'keepy', false)), T0 + 60_000)
    const at = (t: number) => ({ t, x: 30, y: 10 })
    expect(code(() => finishPlay(ctx, 'keepy', [at(20), at(22)]))).toBe('taps')
    expect(code(() => finishPlay(ctx, 'keepy', [at(40), at(20)]))).toBe('taps')
    expect(code(() => finishPlay(ctx, 'keepy', [at(1.5), at(40)]))).toBe('taps')
    // A tap needs where it landed as well as when: a bare step, or a position that is not a number, is refused.
    expect(code(() => finishPlay(ctx, 'keepy', [20, 40] as never))).toBe('taps')
    expect(code(() => finishPlay(ctx, 'keepy', [{ t: 20, x: 'middle', y: 10 }] as never))).toBe('taps')
  })

  it('refuses a play whose taps say it took longer than the clock allows', () => {
    const ctx = apply(context(), startPlay(context(), 'keepy', false))
    const { taps, steps } = perfectKeepyTaps(ctx.state.ticket!.seed)
    expect(code(() => finishPlay(withNow(ctx, T0 + 2000), 'keepy', taps))).toBe('too-fast')
    expect(steps).toBeGreaterThan(300)
  })
})

describe('personal bests', () => {
  /** One free Kick Timer play, `gap` after the start of the test so the energy never runs out, with the given taps. */
  const play = (ctx: FlowContext, taps: (seed: string) => number[]) => {
    const started = apply(ctx, startPlay(ctx, 'kick', false))
    const done = finishPlay(withNow(started, ctx.now + 60_000), 'kick', taps(started.state.ticket!.seed))
    return { next: { ...started, state: done.state }, extra: done.extra!, state: done.state }
  }
  const middling = () => [500, 500, 500, 500, 500]

  it('remembers the best score in each game, and says when a play beats it or by how much it fell short', () => {
    const first = play(context(), middling)
    expect(first.extra).toMatchObject({ previousBest: 0, newBest: first.extra.score > 0 })

    // A perfect play beats it.
    const perfect = play(first.next, perfectKickTaps)
    expect(perfect.extra).toMatchObject({ previousBest: first.extra.score, newBest: true, score: 27 })
    expect(perfect.state.arcade.best).toMatchObject({ kick: 27, keepy: 0, pens: 0, keeper: 0 })

    // A worse one after that leaves the best alone, and does not call itself a best.
    const worse = play(perfect.next, middling)
    expect(worse.extra).toMatchObject({ previousBest: 27, newBest: false })
    expect(worse.state.arcade.best.kick).toBe(27)
  })

  it('keeps a best for each game on its own', () => {
    const ctx = apply(context(), startPlay(context(), 'keepy', false))
    const { taps } = perfectKeepyTaps(ctx.state.ticket!.seed)
    const done = finishPlay(withNow(ctx, T0 + 60_000), 'keepy', taps)
    expect(done.state.arcade.best).toEqual({ ...Object.fromEntries(CABINETS.map(cabinet => [cabinet, 0])), keepy: keepyMax(config) })
  })

  it('counts a play bought with gems too', () => {
    const base = context(state => ({ ...state, idle: { ...state.idle, gems: 40 } }))
    const ctx = apply(base, startPlay(base, 'kick', true))
    const done = finishPlay(withNow(ctx, T0 + 60_000), 'kick', perfectKickTaps(ctx.state.ticket!.seed))
    expect(done.state.arcade.best.kick).toBe(27)
  })
})

describe('a play bought with gems', () => {
  it('pays coins and Pass XP, never tokens', () => {
    const base = context(state => ({ ...state, idle: { ...state.idle, gems: 40 } }))
    const ctx = apply(base, startPlay(base, 'kick', true))
    const taps = perfectKickTaps(ctx.state.ticket!.seed)
    const done = finishPlay(withNow(ctx, T0 + 60_000), 'kick', taps)
    expect(done.extra).toEqual({ score: 27, max: 27, tokens: 0, coins: config.cabinets.gemPlayCoins, previousBest: 0, newBest: true, hot: hotCabinet(T0, config) === 'kick' })
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

describe('the penalty shootout in the arcade', () => {
  it('is a third cabinet that shares the energy, is scored by the server from the taps, and pays tokens for the score', () => {
    const base = context()
    const started = apply(base, startPlay(base, 'pens', false))
    expect(started.state.ticket).toMatchObject({ kind: 'pens', paid: false })
    expect(energyAt(started.state, config, started.now)).toBe(4)

    const taps = perfectPenaltyTaps(started.state.ticket!.seed)
    const done = finishPlay(withNow(started, T0 + taps.reduce((sum, tap) => sum + tap, 0) + 5000), 'pens', taps)
    expect(done.extra).toMatchObject({ score: 10, max: 10, tokens: config.cabinets.playMaxTokens, coins: 0, newBest: true })
    expect(done.state.arcade.best).toMatchObject({ pens: 10, kick: 0, keepy: 0 })
    expect(done.ledger).toEqual([{ currency: 'tokens', amount: config.cabinets.playMaxTokens, reason: 'arcade', ref: 'pens' }])
  })

  it('refuses taps a person could not make, the wrong number of them, and a result sent faster than the play', () => {
    const ctx = apply(context(), startPlay(context(), 'pens', false))
    const taps = perfectPenaltyTaps(ctx.state.ticket!.seed)
    const total = taps.reduce((sum, tap) => sum + tap, 0)
    expect(code(() => finishPlay(withNow(ctx, T0 + 60_000), 'pens', [10, ...taps.slice(1)]))).toBe('taps')
    expect(code(() => finishPlay(withNow(ctx, T0 + 60_000), 'pens', taps.slice(0, 3)))).toBe('taps')
    expect(code(() => finishPlay(withNow(ctx, T0 + 200), 'pens', taps))).toBe('too-fast')
    expect(code(() => finishPlay(withNow(ctx, T0 + total + 5000), 'pens', taps))).toBe('accepted')
  })

  it('takes its turn as the cabinet of the day', () => {
    const days = Array.from({ length: CABINETS.length * 2 }, (_, day) => hotCabinet(T0 + day * DAY, DEFAULT_CONFIG))
    expect(days.filter(cabinet => cabinet === 'pens')).toHaveLength(2)
  })
})

describe('the five newer cabinets', () => {
  const fresh = ['keeper', 'pass', 'dribble', 'targets', 'cones'] as const

  it('each cost energy, are scored by the server from what the phone sent, pay tokens for the score and keep a best', () => {
    for (const cabinet of fresh) {
      const base = context()
      const started = apply(base, startPlay(base, cabinet, false))
      expect(started.state.ticket).toMatchObject({ kind: cabinet, paid: false })
      expect(energyAt(started.state, config, started.now)).toBe(4)
      const taps = perfectTaps(cabinet, started.state.ticket!.seed, config)
      const done = finishPlay(withNow(started, T0 + 60_000), cabinet, taps)
      const max = cabinetMax(cabinet, config)
      expect(done.extra, cabinet).toMatchObject({ score: max, max, tokens: config.cabinets.playMaxTokens, coins: 0, newBest: true })
      expect(done.state.arcade.best[cabinet]).toBe(max)
      expect(done.ledger).toEqual([{ currency: 'tokens', amount: config.cabinets.playMaxTokens, reason: 'arcade', ref: cabinet }])
    }
  })

  it('pay a share of the tokens for a part score, by the same sum as the others', () => {
    const base = context()
    const started = apply(base, startPlay(base, 'cones', false))
    const right = perfectTaps('cones', started.state.ticket!.seed, config)
    const wrong = right.map((slot, round) => (round < 3 ? slot : (slot + 1) % config.minigames.cones.cones))
    const done = finishPlay(withNow(started, T0 + 60_000), 'cones', wrong)
    expect(done.extra).toMatchObject({ score: 3, max: 5, tokens: Math.floor((config.cabinets.playMaxTokens * 3) / 5) })
  })

  it('refuse a result sent faster than the play could have been played', () => {
    for (const cabinet of fresh) {
      const base = context()
      const started = apply(base, startPlay(base, cabinet, false))
      const taps = perfectTaps(cabinet, started.state.ticket!.seed, config)
      expect(code(() => finishPlay(withNow(started, T0 + 300), cabinet, taps)), cabinet).toBe('too-fast')
    }
  })

  it('refuse a play of one cabinet sent to another', () => {
    const base = context()
    const started = apply(base, startPlay(base, 'keeper', false))
    expect(code(() => finishPlay(withNow(started, T0 + 60_000), 'cones', [0, 0, 0, 0, 0]))).toBe('no-ticket')
  })
})
