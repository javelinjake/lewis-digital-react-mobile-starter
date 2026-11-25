import { DEFAULT_CONFIG, HAIR_STYLES } from '@ld/pixel-pitch-core'
import { beforeEach, describe, expect, it } from 'vitest'
import { gameApi } from '@/features/game/api/game.mock'
import { leagueName } from '@/features/game/lib/club'
import { playerLayers } from '@/features/game/lib/player-layers'
import { useAuthStore } from '@/stores/auth.store'

const HOUR = 60 * 60 * 1000
const newClub = { name: 'Harbour Town', crest: 5, kitPrimary: '#3f7fd6', kitSecondary: '#f4f4f4' }

describe('the mock game api', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useAuthStore.setState({ userId: `user-${Math.random()}` })
  })

  it('has no club until onboarding, then a fielded squad and a won debut', async () => {
    expect(await gameApi.sync()).toBeNull()
    const created = await gameApi.createClub(newClub)
    expect(created.cards).toHaveLength(5)
    expect(created.club.state.lineup.every(Boolean)).toBe(true)
    expect(created.fixtures[0]).toMatchObject({ no: -1, result: 'win' })
    expect(created.club.state.idle.gems).toBe(DEFAULT_CONFIG.daily.gems)
    await expect(gameApi.createClub(newClub)).rejects.toThrow('already have a club')
  })

  it('plays the matches that fell due when the clock moves on, and lists them newest first', async () => {
    await gameApi.createClub(newClub)
    window.__pixelPitchClock!.advance(10 * HOUR)
    const synced = await gameApi.sync()
    // The first kicks off 10 minutes after the debut, then one every 3 hours.
    expect(synced!.fixtures.map(fixture => fixture.no)).toEqual([0, 1, 2, 3])
    expect((await gameApi.readFixtures(2)).map(fixture => fixture.no)).toEqual([3, 2])
  })

  it('refuses what the server would refuse', async () => {
    const created = await gameApi.createClub(newClub)
    await expect(gameApi.setLineup('2-2', [created.cards[0].id, created.cards[0].id, null, null, null])).rejects.toThrow('only fill one slot')
    await expect(gameApi.sell(created.cards[0].id)).rejects.toThrow('out of the lineup')
  })
})

describe('sprites and labels', () => {
  it('layers a player body, kit, boots and hair, with gloves for a keeper', () => {
    const outfield = playerLayers({ skin: 0, hairStyle: HAIR_STYLES.indexOf('afro'), hairColour: 0 }, ['#ff0000', '#00ff00'])
    expect(outfield.map(layer => layer.path)).toEqual([
      'players/body/body_skin1.png',
      'players/kit/kit_plain_template.png',
      'players/kit/shorts_template.png',
      'players/kit/socks_template.png',
      'players/kit/boots.png',
      'players/hair/hair_afro_black.png',
    ])
    const keeper = playerLayers({ skin: 4, hairStyle: 0, hairColour: 0 }, ['#ff0000', '#00ff00'], 'GK')
    expect(keeper.at(-1)!.path).toBe('players/kit/gk_gloves.png')
    expect(keeper.some(layer => layer.path.includes('hair'))).toBe(false)
  })

  it('names the ladder League 5 to League 1, then Prestige', () => {
    expect([1, 5, 6].map(leagueName)).toEqual(['League 5', 'League 1', 'Prestige 1'])
  })
})

describe('the written match report', () => {
  it('has a beat per setup and outcome, holds each long enough to read, and the whole match comes to about half a minute', async () => {
    const { beatsOf, totalMs } = await import('@/features/game/lib/beats')
    const { commentate, DEFAULT_CONFIG: config, FORMATIONS } = await import('@ld/pixel-pitch-core')
    const fixture = {
      no: 1,
      kickoffAt: 0,
      formation: '2-2' as const,
      squads: { ours: ['A One', 'B Two', 'C Three', 'D Four', 'E Five'], theirs: ['F One', 'G Two', 'H Three', 'I Four', 'J Five'] },
      rival: { index: 0, name: 'Rovers', formation: '1-2-1' as const, rating: 50, att: 50, def: 50 },
      events: [{ minute: 12, side: 'for' as const, kind: 'goal' as const, slot: 0 }, { minute: 30, side: 'against' as const, kind: 'save' as const, slot: 1 }],
      goalsFor: 1,
      goalsAgainst: 0,
      result: 'win' as const,
    }
    expect(FORMATIONS['2-2'].roles).toHaveLength(5)
    const moments = commentate({ clubName: 'Us', fixture, config, seed: 'x' })
    const beats = beatsOf(moments)
    // Two beats for a chance, one for everything else.
    expect(beats).toHaveLength(moments.reduce((sum, moment) => sum + (moment.outcome === null ? 1 : 2), 0))
    expect(beats.map(beat => beat.moment)).toEqual([...beats.map(beat => beat.moment)].sort((a, b) => a - b))
    for (const beat of beats) {
      expect(beat.ms).toBeGreaterThanOrEqual(1400)
      expect(beat.ms).toBeLessThanOrEqual(4600)
    }
    // A goal's outcome is held longer than a setup, so the finish can be read.
    const goal = moments.findIndex(moment => moment.kind === 'goal')
    const [setup, outcome] = beats.filter(beat => beat.moment === goal)
    expect(setup.part).toBe('setup')
    expect(outcome.ms).toBeGreaterThan(setup.ms)
    expect(totalMs(beats)).toBeGreaterThan(12_000)
    expect(totalMs(beats)).toBeLessThan(45_000)
  })
})

describe('local notifications', () => {
  it('plans a shelf alert, a full-time alert after the next kick-off and a trays alert, and drops the shelf one when it is full', async () => {
    const { buildNotificationPlans } = await import('@/features/game/lib/notification-plans')
    const { planNotifications } = await import('@ld/native/notification-plan')
    useAuthStore.setState({ userId: `user-${Math.random()}` })
    sessionStorage.clear()
    const created = await gameApi.createClub(newClub)
    const plans = buildNotificationPlans(created, DEFAULT_CONFIG)

    const byType = Object.fromEntries(plans.map(plan => [plan.type, plan]))
    expect(Object.keys(byType).sort()).toEqual(['full-time', 'shelf-full', 'trays-full'])
    expect(byType['full-time'].at).toBe(created.club.state.league.nextKickoffAt + 60_000)
    // A new club starts with three packs: seven more at 45 minutes each fill the shelf. And 8 hours of tray (a new
    // club's energy is full, so the tray is next).
    expect(byType['shelf-full'].at).toBe(created.club.state.idle.shelfClockAt + (10 - DEFAULT_CONFIG.onboarding.starterShelfPacks) * 45 * 60_000)
    expect(byType['trays-full'].at).toBe(created.club.state.idle.trayCollectedAt + 8 * HOUR)

    const full = { ...created, club: { ...created.club, state: { ...created.club.state, idle: { ...created.club.state.idle, shelfPacks: 10 } } } }
    expect(buildNotificationPlans(full, DEFAULT_CONFIG).some(plan => plan.type === 'shelf-full')).toBe(false)

    // The shared planner keeps alerts out of quiet hours and drops the types the player switched off.
    const allowed = planNotifications(plans, { enabledTypes: ['full-time'], now: created.now })
    expect(allowed.map(plan => plan.type)).toEqual(['full-time'])
  })
})

describe('the shop in the playtest build', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useAuthStore.setState({ userId: `user-${Math.random()}` })
  })

  it('pays pretend purchases at once, as the webhook would, and spends gems on what the shop lists', async () => {
    const created = await gameApi.createClub(newClub)
    const gems = await gameApi.pretendPurchase!('pp_gems_500')
    expect(gems.club.state.idle.gems).toBe(created.club.state.idle.gems + 500)

    const pass = await gameApi.pretendPurchase!('pp_league_pass')
    expect(pass.club.state.idle.hasPass).toBe(true)

    const starter = await gameApi.pretendPurchase!('pp_starter')
    expect(starter.club.state.signings.pending).toBe(1)

    const kit = await gameApi.buyKit('claret')
    expect(kit.club.kitPrimary).toBe('#7a1f3d')
    expect(kit.club.state.kits).toEqual(['claret'])
    const crest = await gameApi.changeIdentity({ crest: 9 })
    expect(crest.club.crest).toBe(9)
    // The kit survives a sync: it is stored on the club, not only in the answer.
    expect((await gameApi.sync())!.club).toMatchObject({ crest: 9, kitPrimary: '#7a1f3d' })
  })
})

describe('first steps', () => {
  it('starts with opening a pack and is done once everything has been tried', async () => {
    const { firstSteps } = await import('@/features/game/lib/first-steps')
    useAuthStore.setState({ userId: `user-${Math.random()}` })
    sessionStorage.clear()
    const created = await gameApi.createClub(newClub)
    expect(firstSteps(created).find(step => !step.done)?.id).toBe('open-pack')
    const state = created.club.state
    const done = { ...created, cards: [...created.cards, ...created.cards], club: { ...created.club, state: { ...state, packsOpened: 1, ticketsIssued: 1, league: { ...state.league, fixtureNo: 1 }, calendar: { streak: 1, lastClaimDay: 1 } } } }
    expect(firstSteps(done).every(step => step.done)).toBe(true)
  })
})
