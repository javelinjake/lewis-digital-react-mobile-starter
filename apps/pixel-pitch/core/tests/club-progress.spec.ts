import { describe, expect, it } from 'vitest'
import { albumPower, albumSets, DEFAULT_CONFIG, foundClub, generateCatalogue, lineupForMatch, newClubState, recordCollected, scoreLineup, setLineup, syncClub, upgradeState } from '../src'

const config = DEFAULT_CONFIG
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const T0 = Date.UTC(2026, 10, 9, 12)
const catalogue = generateCatalogue(config)
const byId = new Map(catalogue.map(player => [player.id, player]))
const players = (id: string) => byId.get(id)

function founded(clubId: string | number = 'club-1') {
  const club = foundClub({ clubId, now: T0, config, catalogue, players })
  const cards = club.cards.map((card, index) => ({ ...card, id: String(index + 1) }))
  const state = { ...club.state, lineup: club.state.lineup.map(id => (id ? String(Number(id.slice(4)) + 1) : null)) }
  return { ...club, cards, state }
}

describe('foundClub', () => {
  it('makes a club with a fielded starter squad (one Pro), a won debut, gems and goals for today', () => {
    const club = founded()
    expect(club.cards).toHaveLength(5)
    expect(club.cards.filter(card => byId.get(card.playerId)!.rarity === 'pro')).toHaveLength(1)
    expect(club.state.lineup.every(Boolean)).toBe(true)
    expect(club.debut.result).toBe('win')
    expect(club.state.coins).toBe(config.league.winCoins)
    expect(club.state.idle.gems).toBe(config.daily.gems)
    expect(club.state.daily.goals).toHaveLength(config.daily.goalsPerDay)
    expect(club.state.album.collected.sort()).toEqual(club.cards.map(card => card.playerId).sort())
    expect(club.state.pass.season).toBeGreaterThanOrEqual(0)
  })

  it('makes the same club for the same id', () => {
    expect(foundClub({ clubId: 7, now: T0, config, catalogue, players })).toEqual(foundClub({ clubId: 7, now: T0, config, catalogue, players }))
  })
})

describe('syncClub and progress', () => {
  it('gives Pass XP for each match played, and a little more for a win', () => {
    const club = founded()
    const result = syncClub({ state: club.state, cards: club.cards, players, clubId: 'club-1', config, now: T0 + 12 * HOUR })
    const wins = result.fixtures.filter(match => match.result === 'win').length
    expect(result.fixtures).toHaveLength(4)
    expect(result.state.pass.xp).toBe(result.fixtures.length * config.pass.xp.match + wins * config.pass.xp.win)
  })

  it('counts a win towards today\'s goal, but not a win from an earlier day', () => {
    const club = founded()
    const withGoal = (state: typeof club.state) => ({ ...state, daily: { ...state.daily, goals: [{ id: 'win', kind: 'winMatches' as const, target: 1, progress: 0, claimed: false }, ...state.daily.goals.slice(1)] } })
    const today = syncClub({ state: withGoal(club.state), cards: club.cards, players, clubId: 'club-1', config, now: T0 + 3 * HOUR })
    const won = today.fixtures[0].result === 'win'
    expect(today.state.daily.goals[0].progress).toBe(won ? 1 : 0)

    // Matches played on earlier days do not help the goals of the day the player comes back.
    const away = syncClub({ state: withGoal(club.state), cards: club.cards, players, clubId: 'club-1', config, now: T0 + 3 * DAY })
    expect(away.state.daily.day).toBeGreaterThan(club.state.daily.day)
    const todays = away.fixtures.filter(match => Math.floor(match.kickoffAt / DAY) === Math.floor((T0 + 3 * DAY) / DAY) && match.result === 'win').length
    expect(away.state.daily.goals.find(goal => goal.kind === 'winMatches')?.progress ?? 0).toBeLessThanOrEqual(1)
    expect(away.state.daily.goals.find(goal => goal.kind === 'winMatches')?.progress ?? 0).toBe(away.state.daily.goals.some(goal => goal.kind === 'winMatches') ? Math.min(1, todays) : 0)
  })

  it('starts a new season with an empty Pass when 28 days have passed', () => {
    const club = founded()
    const result = syncClub({ state: club.state, cards: club.cards, players, clubId: 'club-1', config, now: T0 + 30 * DAY })
    expect(result.state.pass.season).toBeGreaterThan(club.state.pass.season)
  })
})

describe('the album and the lineup', () => {
  it('adds a percent of team power for each finished set, to the score, ATT and DEF', () => {
    const club = founded()
    const lineup = lineupForMatch(club.state, club.cards, players, config)
    const plain = scoreLineup(lineup.formation, lineup.players, 0)
    expect(lineup.bonus).toBe(0)

    const sets = albumSets(catalogue, config)
    const three = recordCollected(club.state, sets.slice(0, 3).flatMap(set => set.playerIds), sets)
    expect(three.album.completed).toBe(3)
    expect(albumPower(three, config)).toBeCloseTo(0.03, 9)
    const boosted = lineupForMatch(three, club.cards, players, config)
    const withBonus = scoreLineup(boosted.formation, boosted.players, boosted.bonus)
    expect(withBonus.exact / plain.exact).toBeCloseTo(1.03, 9)
    expect(withBonus.att / plain.att).toBeCloseTo(1.03, 9)
    expect(withBonus.def / plain.def).toBeCloseTo(1.03, 9)
  })

  it('is counted by recordCollected without double counting a player pulled twice', () => {
    const sets = albumSets(catalogue, config)
    const state = newClubState(T0, config)
    const once = recordCollected(state, sets[0].playerIds, sets)
    expect(recordCollected(once, sets[0].playerIds, sets)).toBe(once)
    expect(once.album.collected).toHaveLength(6)
    expect(once.album.completed).toBe(1)
  })
})

describe('upgradeState', () => {
  it('fills in every field a club saved before this version lacks, and keeps what it has', () => {
    const old = { idle: newClubState(T0, config).idle, league: newClubState(T0, config).league, formation: '3-1', lineup: ['1', null, null, null, null], pity: 12, coins: 500, tokens: 3 } as never
    const upgraded = upgradeState(old, config)
    expect(upgraded).toMatchObject({ formation: '3-1', pity: 12, coins: 500, tokens: 3, packsOpened: 0, pendingPack: null, starPacks: 0 })
    expect(upgraded.pass.season).toBe(-1)
    expect(upgraded.album).toEqual({ collected: [], completed: 0, claimed: [] })
    expect(upgraded.cabinetPlays.kick).toEqual({ day: -1, count: 0 })
    expect(setLineup(upgraded, '2-2', [null, null, null, null, null], []).formation).toBe('2-2')
  })
})
