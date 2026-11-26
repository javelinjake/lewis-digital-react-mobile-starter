import type { ClubState, LineupForMatch } from '../src'
import { describe, expect, it } from 'vitest'
import { collectStadium, DEFAULT_CONFIG, FOOTBALLERS, FORMATIONS, newClubState, newLeagueState, playDueFixtures, prestigeLevel, tierRating, upgradeState, withPrestige } from '../src'

const config = { ...DEFAULT_CONFIG, league: { ...DEFAULT_CONFIG.league, openingGapsMinutes: [] } }
const HOUR = 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 8, 12)
const strong: LineupForMatch = { formation: '2-2', players: FORMATIONS['2-2'].roles.map((position, index) => ({ position, rating: 99, nation: index % 4 })) }

describe('prestige', () => {
  it('keeps rivals getting stronger past League 1, but never past what a squad can reach', () => {
    expect(tierRating(6, config)).toBeGreaterThan(tierRating(5, config))
    expect(tierRating(7, config) - tierRating(6, config)).toBe(config.league.rivalPrestigeStep)
    expect(tierRating(60, config)).toBe(config.league.rivalMaxRating)
    expect(config.league.rivalMaxRating).toBeLessThan(99)
  })

  it('pays 2% more coins for each Prestige tier, from matches and the stadium', () => {
    expect(prestigeLevel(5)).toBe(0)
    expect(withPrestige(1000, 5, config)).toBe(1000)
    expect(withPrestige(1000, 8, config)).toBe(1060)
    const result = playDueFixtures({ league: { ...newLeagueState(T0, config), tier: 7 }, lineup: strong, clubId: 'c', config, now: T0 + 3 * HOUR })
    const match = result.results[0]
    const base = match.result === 'win' ? config.league.winCoins : match.result === 'draw' ? config.league.drawCoins : config.league.lossCoins
    expect(match.coins).toBe(Math.round(base * 1.04))

    const state: ClubState = { ...newClubState(T0, config), league: { ...newClubState(T0, config).league, tier: 6 } }
    const plain = collectStadium({ state: { ...state, league: { ...state.league, tier: 1 } }, cards: [], catalogue: FOOTBALLERS, players: () => undefined, config, clubId: 'c', now: T0 + 4 * HOUR })
    const bonus = collectStadium({ state, cards: [], catalogue: FOOTBALLERS, players: () => undefined, config, clubId: 'c', now: T0 + 4 * HOUR })
    expect(bonus.extra!.coins).toBe(Math.round(plain.extra!.coins * 1.02))
  })

  it('puts every promotion in the trophy cabinet, and fills it for a club from before it existed', () => {
    const old = { ...newClubState(T0, config), league: { ...newClubState(T0, config).league, tier: 7 } } as Partial<ClubState> & Pick<ClubState, 'idle' | 'league'>
    delete old.trophies
    expect(upgradeState(old, config).trophies.map(trophy => trophy.tier)).toEqual([2, 3, 4, 5, 6, 7])
  })
})
