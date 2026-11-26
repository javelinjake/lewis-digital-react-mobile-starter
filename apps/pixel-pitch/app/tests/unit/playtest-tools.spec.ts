import { dayIndex, DEFAULT_CONFIG, energyAt, tierReached } from '@ld/pixel-pitch-core'
import { beforeEach, describe, expect, it } from 'vitest'
import { gameApi } from '@/features/game/api/game.mock'
import { useAuthStore } from '@/stores/auth.store'

const config = DEFAULT_CONFIG
const newClub = { name: 'Harbour Town', crest: 5, kitPrimary: '#3f7fd6', kitSecondary: '#f4f4f4' }
const tools = () => window.__pixelPitchPlaytest!

describe('the playtest tools', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    useAuthStore.setState({ userId: `user-${Math.random()}` })
    await gameApi.createClub(newClub)
  })

  it('start the next day: one day on, with new goals, a calendar day, the free pack and the day\'s gems', async () => {
    await gameApi.claimFreePack()
    await gameApi.claimCalendar()
    const before = (await gameApi.sync())!
    tools().nextDay()
    const after = (await gameApi.sync())!
    expect(dayIndex(after.now, config)).toBe(dayIndex(before.now, config) + 1)
    expect(after.club.state.daily.freePackClaimed).toBe(false)
    expect(after.club.state.daily.goals.every(goal => goal.progress === 0 || goal.kind === 'winMatches')).toBe(true)
    expect(after.club.state.idle.gems).toBe(before.club.state.idle.gems + config.daily.gems)
    // The calendar carries on: day 2 can be claimed.
    expect((await gameApi.claimCalendar()).day).toBe(2)
    // Again and again, a day at a time.
    tools().nextDay()
    expect(dayIndex((await gameApi.sync())!.now, config)).toBe(dayIndex(before.now, config) + 2)
  })

  it('stand in for the shop: the League Pass, gems and a bundle', async () => {
    const before = (await gameApi.sync())!.club.state
    window.__pixelPitchClock!.setPass(true)
    tools().grant({ gems: 100 })
    tools().grant({ starPacks: 3, coins: 5000, gems: 100 })
    const { state } = (await gameApi.sync())!.club
    expect(tools().status().hasPass).toBe(true)
    expect(state.idle.hasPass).toBe(true)
    expect(energyAt(state, config, Date.now())).toBe(config.cabinets.energy.maxWithPass)
    expect(state.idle.gems).toBe(before.idle.gems + 200)
    expect(state.coins).toBe(before.coins + 5000)
    expect(state.starPacks).toBe(before.starPacks + 3)
    // A granted Star pack opens like any other.
    expect((await gameApi.openPack('star')).club.state.pendingPack).not.toBeNull()
  })

  it('top up: energy, tokens, packs, goals ready to claim and Pass XP', async () => {
    for (let play = 0; play < 5; play++) {
      await gameApi.startPlay('keepy', false)
      // The play has to take as long as a play takes: the ball needs a moment to drop.
      window.__pixelPitchClock!.advance(30_000)
      await gameApi.finishPlay('keepy', [])
    }
    await expect(gameApi.startPlay('keepy', false)).rejects.toThrow(/energy/i)
    tools().refillEnergy()
    await gameApi.startPlay('kick', false)

    tools().grant({ tokens: 300, packs: 5 })
    tools().finishGoals()
    tools().addPassXp(500)
    const { state } = (await gameApi.sync())!.club
    expect(state.tokens).toBeGreaterThanOrEqual(300)
    expect(state.idle.shelfPacks).toBeGreaterThanOrEqual(5)
    expect(state.daily.goals.every(goal => goal.progress >= goal.target)).toBe(true)
    expect(tierReached(state, config)).toBeGreaterThanOrEqual(5)
    // The finished goals and Pass tiers are claimed on their own screens: Claim all leaves them.
    const claimed = await gameApi.claimAll()
    expect(claimed.club.state.daily.goals.every(goal => !goal.claimed)).toBe(true)
    await gameApi.claimGoal(claimed.club.state.daily.goals[0].id)
    // The free track pays every second tier.
    await gameApi.claimPassTier('free', 2)
  })

  it('reset: the club is gone and the clock is back to real time', async () => {
    window.__pixelPitchClock!.advance(5 * 60 * 60 * 1000)
    expect(tools().status()).toMatchObject({ hasClub: true, offsetMs: 5 * 60 * 60 * 1000 })
    tools().reset()
    expect(tools().status()).toEqual({ hasClub: false, hasPass: false, offsetMs: 0 })
    expect(await gameApi.sync()).toBeNull()
    expect((await gameApi.createClub(newClub)).cards).toHaveLength(5)
  })
})
