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
    expect(synced!.fixtures.map(fixture => fixture.no)).toEqual([0, 1, 2])
    expect((await gameApi.readFixtures(2)).map(fixture => fixture.no)).toEqual([2, 1])
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
  it('spreads the lines over about 18 seconds, never closer than half a second', async () => {
    const { lineTimes, DURATION_MS } = await import('@/features/game/lib/line-times')
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
    const lines = commentate({ clubName: 'Us', fixture, config, seed: 'x' })
    const times = lineTimes(lines, config.match.minutes)
    expect(times).toHaveLength(lines.length)
    expect(times[0]).toBe(0)
    for (let i = 1; i < times.length; i++)
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(450)
    expect(times.at(-1)!).toBeLessThanOrEqual(DURATION_MS + 450 * lines.length)
    expect(times.at(-1)!).toBeGreaterThanOrEqual(DURATION_MS - 1)
  })
})
