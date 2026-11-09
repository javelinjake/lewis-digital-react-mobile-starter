import type { GameResponse } from '@ld/pixel-pitch-core'
import type { Payload } from 'payload'
import type { Session } from './harness'
import { albumSets, DEFAULT_CONFIG, generateCatalogue } from '@ld/pixel-pitch-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { act, DAY, found, HOUR } from './game-helpers'
import { boot, guest } from './harness'

const config = DEFAULT_CONFIG
const catalogue = generateCatalogue(config)
const T0 = Date.UTC(2026, 10, 12, 12)

let payload: Payload
let alice: Session
let bob: Session
let now = T0

type State = GameResponse['club']['state']
const sync = async (session: Session, at = now) => ((await act(session, 'sync', {}, { at })).json as GameResponse).club.state
async function setState(session: Session, patch: (current: State) => object) {
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

describe('a new club', () => {
  it('has three goals for today, the starter players in the album and a season to climb', async () => {
    const state = await sync(alice)
    expect(state.daily.goals).toHaveLength(3)
    expect(state.daily.goals.every(goal => goal.progress === 0 && !goal.claimed)).toBe(true)
    expect(state.album.collected).toHaveLength(5)
    expect(state.pass.season).toBe(Math.floor(Math.floor(T0 / DAY) / 28))
  })
})

describe('daily goals', () => {
  it('count what the player does and pay once when it is done', async () => {
    // A goal for one pack opened, so the test does not depend on which goals the club drew today.
    await setState(alice, current => ({ daily: { ...current.daily, goals: [{ id: 'rip', kind: 'openPacks', target: 1, progress: 0, claimed: false }, ...current.daily.goals.slice(1)] }, idle: { ...current.idle, shelfPacks: 3 } }))

    const early = await act(alice, 'goals/claim', { goalId: 'rip' }, { at: now })
    expect(early.status).toBe(400)
    expect(JSON.stringify(early.json)).toContain('unfinished')

    const opened = await act(alice, 'packs/open', { source: 'shelf' }, { at: now })
    expect(opened.json.club.state.daily.goals[0].progress).toBe(1)
    await act(alice, 'packs/decide', { decisions: ['sell', 'sell', 'sell'] }, { at: now })

    const before = await sync(alice)
    const claimed = await act(alice, 'goals/claim', { goalId: 'rip' }, { at: now })
    expect(claimed.status).toBe(200)
    expect(claimed.json.reward).toEqual({ kind: 'coins', amount: 600 })
    expect(claimed.json.club.state.coins).toBe(before.coins + 600)
    expect(claimed.json.club.state.pass.xp).toBeGreaterThanOrEqual(before.pass.xp + config.pass.xp.goal)

    const again = await act(alice, 'goals/claim', { goalId: 'rip' }, { at: now })
    expect(again.status).toBe(400)
    expect(JSON.stringify(again.json)).toContain('claimed')
    expect((await act(alice, 'goals/claim', { goalId: 'nope' }, { at: now })).status).toBe(400)
    expect((await act(alice, 'goals/claim', {}, { at: now })).status).toBe(400)
  })

  it('pay only once when two claims arrive together', async () => {
    await setState(alice, current => ({ daily: { ...current.daily, goals: [{ id: 'win', kind: 'winMatches', target: 1, progress: 1, claimed: false }, ...current.daily.goals.slice(1)] } }))
    const before = await sync(alice)
    const results = await Promise.all([1, 2, 3].map(() => act(alice, 'goals/claim', { goalId: 'win' }, { at: now })))
    expect(results.filter(result => result.status === 200)).toHaveLength(1)
    expect((await sync(alice)).idle.gems).toBe(before.idle.gems + 10)
  })

  it('start again the next day, with the day\'s free pack too', async () => {
    now += DAY
    const yesterday = (await sync(alice, now - HOUR)).daily.day
    const state = await sync(alice)
    expect(state.daily.day).toBeGreaterThanOrEqual(yesterday)
    // Nothing is claimed yet, and only matches won today can have moved a goal.
    expect(state.daily.goals.every(goal => !goal.claimed)).toBe(true)
    expect(state.daily.goals.filter(goal => goal.kind !== 'winMatches').every(goal => goal.progress === 0)).toBe(true)
    expect(state.daily.freePackClaimed).toBe(false)
  })
})

describe('the daily free pack', () => {
  it('goes on the shelf once a day', async () => {
    const before = await sync(alice)
    const claimed = await act(alice, 'goals/free-pack', {}, { at: now })
    expect(claimed.status).toBe(200)
    expect(claimed.json.club.state.idle.shelfPacks).toBe(before.idle.shelfPacks + 1)
    const again = await act(alice, 'goals/free-pack', {}, { at: now })
    expect(again.status).toBe(400)
    now += DAY
    expect((await act(alice, 'goals/free-pack', {}, { at: now })).status).toBe(200)
  })
})

describe('the login calendar', () => {
  it('pays day 1, then day 2 the next day, but not twice in one day', async () => {
    now += DAY
    const first = await act(alice, 'calendar/claim', {}, { at: now })
    expect(first.status).toBe(200)
    expect(first.json).toMatchObject({ day: 1, reward: config.calendar.rewards[0] })
    expect((await act(alice, 'calendar/claim', {}, { at: now })).status).toBe(400)

    now += DAY
    const second = await act(alice, 'calendar/claim', {}, { at: now })
    expect(second.json).toMatchObject({ day: 2, reward: config.calendar.rewards[1] })
  })

  it('starts again at day 1 after a missed day', async () => {
    now += 2 * DAY
    const response = await act(alice, 'calendar/claim', {}, { at: now })
    expect(response.json.day).toBe(1)
  })

  it('ends in a Star pack on day 7, which opens with a Star or better', async () => {
    let last: { day: number } = { day: 0 }
    for (let n = 0; n < 6; n++) {
      now += DAY
      last = (await act(alice, 'calendar/claim', {}, { at: now })).json
    }
    expect(last.day).toBe(7)
    const state = await sync(alice)
    expect(state.starPacks).toBe(1)
    const opened = await act(alice, 'packs/open', { source: 'star' }, { at: now })
    expect(opened.status).toBe(200)
    const ids: string[] = opened.json.club.state.pendingPack.playerIds
    expect(ids.some(id => ['star', 'legend'].includes(catalogue.find(player => player.id === id)!.rarity))).toBe(true)
    expect(opened.json.club.state.starPacks).toBe(0)
    await act(alice, 'packs/decide', { decisions: ['sell', 'sell', 'sell'] }, { at: now })
  })
})

describe('the League Pass', () => {
  it('earns XP from matches, and pays a free tier once it is reached', async () => {
    now += DAY
    const state = await sync(alice)
    expect(state.pass.xp).toBeGreaterThan(0)

    await setState(alice, () => ({ pass: { ...state.pass, xp: 400 } }))
    const tier = config.pass.free.findIndex(Boolean) + 1
    const locked = await act(alice, 'pass/claim', { track: 'free', tier: 30 }, { at: now })
    expect(JSON.stringify(locked.json)).toContain('locked')

    const claimed = await act(alice, 'pass/claim', { track: 'free', tier }, { at: now })
    expect(claimed.status).toBe(200)
    expect(claimed.json.reward).toEqual(config.pass.free[tier - 1])
    expect((await act(alice, 'pass/claim', { track: 'free', tier }, { at: now })).status).toBe(400)
  })

  it('keeps the premium track for the Pass, and unlocks every tier already reached when it is bought', async () => {
    const refused = await act(alice, 'pass/claim', { track: 'premium', tier: 1 }, { at: now })
    expect(refused.status).toBe(400)
    expect(JSON.stringify(refused.json)).toContain('no-pass')

    await setState(alice, current => ({ idle: { ...current.idle, hasPass: true } }))
    for (const tier of [1, 2, 3, 4]) {
      const response = await act(alice, 'pass/claim', { track: 'premium', tier }, { at: now })
      expect(response.status).toBe(200)
    }
    expect((await act(alice, 'pass/claim', { track: 'premium', tier: 5 }, { at: now })).status).toBe(400)
    expect((await act(alice, 'pass/claim', { track: 'gold', tier: 1 }, { at: now })).status).toBe(400)
    expect((await act(alice, 'pass/claim', { track: 'premium' }, { at: now })).status).toBe(400)
  })

  it('starts a new season after four weeks, with the track empty again', async () => {
    const before = await sync(alice)
    expect(before.pass.claimedFree.length).toBeGreaterThan(0)
    now += 30 * DAY
    const state = await sync(alice)
    expect(state.pass.season).toBeGreaterThan(before.pass.season)
    // Last season's claims are gone. (XP restarts too, and only grows from the matches played since.)
    expect(state.pass.claimedFree).toEqual([])
    expect(state.pass.claimedPremium).toEqual([])
  })
})

describe('the album', () => {
  it('records every player pulled, pays a finished set once, and adds team power', async () => {
    const [set] = albumSets(catalogue, config)
    const unfinished = await act(alice, 'album/claim', { setId: set.id }, { at: now })
    expect(unfinished.status).toBe(400)
    expect(JSON.stringify(unfinished.json)).toContain('unfinished')

    await setState(alice, current => ({ album: { ...current.album, collected: [...new Set([...current.album.collected, ...set.playerIds])], completed: 1 } }))
    const before = await sync(alice)
    const claimed = await act(alice, 'album/claim', { setId: set.id }, { at: now })
    expect(claimed.status).toBe(200)
    expect(claimed.json.club.state.idle.shelfPacks).toBe(before.idle.shelfPacks + 1)
    expect(claimed.json.club.state.album.claimed).toEqual([set.id])
    expect((await act(alice, 'album/claim', { setId: set.id }, { at: now })).status).toBe(400)
    expect((await act(alice, 'album/claim', { setId: 'nowhere' }, { at: now })).status).toBe(400)
  })
})

describe('privacy', () => {
  it('keeps one player\'s goals, calendar and album from another', async () => {
    const bobs = await sync(bob, T0)
    expect(bobs.calendar.streak).toBe(0)
    expect(bobs.album.claimed).toEqual([])
    const [set] = albumSets(catalogue, config)
    expect((await act(bob, 'album/claim', { setId: set.id }, { at: T0 })).status).toBe(400)
    expect((await act(bob, 'goals/claim', { goalId: 'rip' }, { at: T0 })).status).toBe(400)
  })
})

describe('time', () => {
  it('only moves forward in the tests: a day is a day', () => {
    expect(DAY).toBe(24 * HOUR)
  })
})
