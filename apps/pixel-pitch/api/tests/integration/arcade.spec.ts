import type { GameResponse } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import type { Session } from './harness'
import { DEFAULT_CONFIG } from '@ld/pixel-pitch-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { act, bestWarmupTap, DAY, found, HOUR, perfectKeepyTaps, perfectKickTaps } from './game-helpers'
import { boot, guest } from './harness'

const config = DEFAULT_CONFIG
const T0 = Date.UTC(2026, 10, 11, 12)

let payload: Payload
let alice: Session
let bob: Session
let now = T0

const state = async (session: Session, at = now) => ((await act(session, 'sync', {}, { at })).json as GameResponse).club.state

async function setState(session: Session, patch: (current: GameResponse['club']['state']) => object) {
  const current = (await act(session, 'sync', {}, { at: now })).json as GameResponse
  await payload.update({ collection: 'clubs', id: current.club.id, data: { state: { ...current.club.state, ...patch(current.club.state) } as never }, overrideAccess: true })
}

beforeAll(async () => {
  payload = await boot()
  alice = await guest()
  bob = await guest('bearer')
  await found(alice, T0)
  await found(bob, T0, 'Bob FC')
})

describe('the stadium', () => {
  it('piles up coins while the player is away, and collecting pays them once', async () => {
    now = T0 + 2 * HOUR
    const before = (await state(alice)).coins
    const collected = await act(alice, 'stadium/collect', {}, { at: now })
    expect(collected.status).toBe(200)
    expect(collected.json.coins).toBe(config.stadium.coinsPerHour[0] * 2)
    expect(collected.json.club.state.coins).toBe(before + config.stadium.coinsPerHour[0] * 2)

    const again = await act(alice, 'stadium/collect', {}, { at: now })
    expect(again.status).toBe(400)
    expect(JSON.stringify(again.json)).toContain('empty')

    const row = await payload.find({ collection: 'ledger', where: { and: [{ owner: { equals: alice.user!.id } }, { reason: { equals: 'stadium' } }] }, depth: 0, overrideAccess: true })
    expect(row.docs.at(-1)).toMatchObject({ currency: 'coins', amount: config.stadium.coinsPerHour[0] * 2 })
  })

  it('pays only once when two collections arrive together', async () => {
    now += 3 * HOUR
    const results = await Promise.all([1, 2, 3].map(() => act(alice, 'stadium/collect', {}, { at: now })))
    expect(results.filter(result => result.status === 200)).toHaveLength(1)
  })

  it('upgrades for its price and refuses without the coins', async () => {
    now += HOUR
    await setState(alice, () => ({ coins: 10 }))
    const poor = await act(alice, 'stadium/upgrade', {}, { at: now })
    expect(poor.status).toBe(400)
    expect(JSON.stringify(poor.json)).toContain('coins')

    await setState(alice, () => ({ coins: 5000 }))
    const upgraded = await act(alice, 'stadium/upgrade', {}, { at: now })
    expect(upgraded.status).toBe(200)
    expect(upgraded.json.club.state.idle.stadiumLevel).toBe(2)
    expect(upgraded.json).toMatchObject({ level: 2, cost: config.stadium.upgradeCost[0] })
  })
})

describe('the token trays', () => {
  it('fill while away at 12 tokens an hour and are emptied once', async () => {
    now += 5 * HOUR
    const before = (await state(alice)).tokens
    const response = await act(alice, 'arcade/collect', { cabinet: 'kick' }, { at: now })
    expect(response.status).toBe(200)
    // Started filling when the club was founded, and holds at most 8 hours.
    expect(response.json.tokens).toBe(12 * 8)
    expect(response.json.club.state.tokens).toBe(before + 96)
    expect((await act(alice, 'arcade/collect', { cabinet: 'kick' }, { at: now })).status).toBe(400)
    expect((await act(alice, 'arcade/collect', { cabinet: 'pinball' }, { at: now })).status).toBe(400)
    expect((await act(alice, 'arcade/collect', { cabinet: 'keepy' }, { at: now })).json.tokens).toBe(96)
  })
})

describe('kick Timer', () => {
  it('is started with a ticket and finished with the taps, and pays tokens for the score the server works out', async () => {
    now += HOUR
    const started = await act(alice, 'arcade/start', { cabinet: 'kick' }, { at: now })
    expect(started.status).toBe(200)
    const ticket = started.json.club.state.ticket
    expect(ticket).toMatchObject({ kind: 'kick', paid: false, issuedAt: now })
    expect(typeof ticket.seed).toBe('string')

    const taps = perfectKickTaps(ticket.seed)
    const before = started.json.club.state.tokens
    const finished = await act(alice, 'arcade/finish', { cabinet: 'kick', taps, score: 999, tokens: 99_999 }, { at: now + taps.reduce((a, b) => a + b, 0) + 3000 })
    expect(finished.status).toBe(200)
    // Whatever score the phone claims is ignored: the server replays the taps.
    expect(finished.json).toMatchObject({ score: 15, max: 15, tokens: config.cabinets.playMaxTokens })
    expect(finished.json.club.state.tokens).toBe(before + config.cabinets.playMaxTokens)
    expect(finished.json.club.state.ticket).toBeNull()
  })

  it('cannot be finished twice, or without having been started', async () => {
    const again = await act(alice, 'arcade/finish', { cabinet: 'kick', taps: [500, 500, 500, 500, 500] }, { at: now + 60_000 })
    expect(again.status).toBe(400)
    expect(JSON.stringify(again.json)).toContain('no-ticket')
  })

  it('refuses a result sent faster than the play could have been played', async () => {
    now += HOUR
    const started = await act(alice, 'arcade/start', { cabinet: 'kick' }, { at: now })
    const taps = perfectKickTaps(started.json.club.state.ticket.seed)
    const early = await act(alice, 'arcade/finish', { cabinet: 'kick', taps }, { at: now + 200 })
    expect(early.status).toBe(400)
    expect(JSON.stringify(early.json)).toContain('too-fast')
    const late = await act(alice, 'arcade/finish', { cabinet: 'kick', taps }, { at: now + 11 * 60_000 })
    expect(JSON.stringify(late.json)).toContain('expired')
  })

  it('gives three free plays a day and then asks for gems; the next day starts again', async () => {
    now += 2 * DAY
    for (let play = 0; play < config.cabinets.freePlaysPerDay; play++)
      expect((await act(alice, 'arcade/start', { cabinet: 'kick' }, { at: now })).status).toBe(200)
    const none = await act(alice, 'arcade/start', { cabinet: 'kick' }, { at: now })
    expect(none.status).toBe(400)
    expect(JSON.stringify(none.json)).toContain('no-plays')
    expect((await act(alice, 'arcade/start', { cabinet: 'keepy' }, { at: now })).status).toBe(200)
    now += DAY
    expect((await act(alice, 'arcade/start', { cabinet: 'kick' }, { at: now })).status).toBe(200)
  })

  it('sells an extra play for gems that pays coins, not tokens', async () => {
    now += DAY
    await setState(alice, current => ({ idle: { ...current.idle, gems: 5 } }))
    const poor = await act(alice, 'arcade/start', { cabinet: 'kick', paid: true }, { at: now })
    expect(poor.status).toBe(400)
    expect(JSON.stringify(poor.json)).toContain('gems')

    await setState(alice, current => ({ idle: { ...current.idle, gems: 100 } }))
    const paid = await act(alice, 'arcade/start', { cabinet: 'kick', paid: true }, { at: now })
    expect(paid.status).toBe(200)
    expect(paid.json.club.state.idle.gems).toBe(80)
    const taps = perfectKickTaps(paid.json.club.state.ticket.seed)
    const tokens = paid.json.club.state.tokens
    const finished = await act(alice, 'arcade/finish', { cabinet: 'kick', taps }, { at: now + 60_000 })
    expect(finished.json).toMatchObject({ tokens: 0, coins: config.cabinets.gemPlayCoins })
    expect(finished.json.club.state.tokens).toBe(tokens)
  })
})

describe('keepy-Uppy', () => {
  it('replays the taps on the server, and pays for the kicks', async () => {
    now += DAY
    const started = await act(alice, 'arcade/start', { cabinet: 'keepy' }, { at: now })
    expect(started.status).toBe(200)
    const { taps, steps } = perfectKeepyTaps(started.json.club.state.ticket.seed)
    const finished = await act(alice, 'arcade/finish', { cabinet: 'keepy', taps }, { at: now + (steps / 60) * 1000 + 1000 })
    expect(finished.status).toBe(200)
    expect(finished.json).toMatchObject({ score: 50, max: 50, tokens: config.cabinets.playMaxTokens })
  })

  it('pays for fewer kicks if the taps stop, and refuses taps no person could make', async () => {
    now += 2 * HOUR
    const started = await act(alice, 'arcade/start', { cabinet: 'keepy' }, { at: now })
    const { taps } = perfectKeepyTaps(started.json.club.state.ticket.seed)
    const cheat = await act(alice, 'arcade/finish', { cabinet: 'keepy', taps: [10, 11, 12, 13] }, { at: now + 60_000 })
    expect(cheat.status).toBe(400)
    const half = await act(alice, 'arcade/finish', { cabinet: 'keepy', taps: taps.slice(0, 20) }, { at: now + 60_000 })
    expect(half.json.score).toBe(20)
    expect(half.json.tokens).toBe(Math.floor((config.cabinets.playMaxTokens * 20) / 50))
  })
})

describe('the warm-up kick', () => {
  it('gives one try a match and, on gold, a bonus that the next match uses', async () => {
    now += DAY
    const started = await act(alice, 'warmup/start', {}, { at: now })
    expect(started.status).toBe(200)
    expect(started.json.club.state.ticket).toMatchObject({ kind: 'warmup' })
    const second = await act(alice, 'warmup/start', {}, { at: now })
    expect(second.status).toBe(400)
    expect(JSON.stringify(second.json)).toContain('warmup-used')

    const tap = bestWarmupTap(started.json.club.state.ticket.seed)
    const finished = await act(alice, 'warmup/finish', { tapMs: tap }, { at: now + tap + 500 })
    expect(finished.status).toBe(200)
    expect(finished.json).toMatchObject({ zone: 'gold', bonus: config.match.warmupGold })
    expect(finished.json.club.state.league.warmupBonus).toBe(config.match.warmupGold)

    // The next match is played with the bonus, and it is spent.
    const kickoff = finished.json.club.state.league.nextKickoffAt
    const played = await act(alice, 'sync', {}, { at: kickoff + 1000 })
    expect(played.json.fixtures[0].warmupBonus).toBe(config.match.warmupGold)
    expect(played.json.club.state.league.warmupBonus).toBe(0)
    if (played.json.fixtures.length > 1)
      expect(played.json.fixtures[1].warmupBonus).toBe(0)
    now = kickoff + 1000
  })

  it('refuses a made-up result: no warm-up started, or one sent too fast', async () => {
    expect(JSON.stringify((await act(alice, 'warmup/finish', { tapMs: 2000 }, { at: now })).json)).toContain('no-ticket')
    const started = await act(alice, 'warmup/start', {}, { at: now })
    expect(started.status).toBe(200)
    const fast = await act(alice, 'warmup/finish', { tapMs: 3000 }, { at: now + 100 })
    expect(JSON.stringify(fast.json)).toContain('too-fast')
    expect((await act(alice, 'warmup/finish', {}, { at: now + 5000 })).status).toBe(400)
  })
})

describe('privacy', () => {
  it('keeps one player\'s ticket and trays from another\'s', async () => {
    const started = await act(alice, 'arcade/start', { cabinet: 'keepy' }, { at: now })
    expect(started.status).toBe(200)
    // Bob has no ticket, so he cannot finish Alice's play with her taps.
    const taps = perfectKickTaps(started.json.club.state.ticket.seed)
    const stolen = await act(bob, 'arcade/finish', { cabinet: 'kick', taps }, { at: now + 60_000 })
    expect(stolen.status).toBe(400)
    const bobs = await state(bob, now)
    expect(bobs.ticket).toBeNull()
    expect(bobs.tokens).toBe(0)
  })
})
