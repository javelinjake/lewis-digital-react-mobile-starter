import type { Fielded, LineupForMatch, LeagueState } from '../src'
import { createRng } from '@ld/utils/random/rng'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, FORMATIONS, generateRivals, leagueLabel, leagueTable, newLeagueState, playDueFixtures, tierRating } from '../src'

const config = DEFAULT_CONFIG
const HOUR = 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 8, 12)

const squad = (rating: number): LineupForMatch => ({
  formation: '2-2',
  players: FORMATIONS['2-2'].roles.map((role, index): Fielded => ({ position: role, rating, nation: index % 4 })),
})
const average = squad(60)
const strong = squad(99)
const empty: LineupForMatch = { formation: '2-2', players: [null, null, null, null, null] }

const play = (league: LeagueState, lineup: LineupForMatch, now: number, clubId = 'club-1') => playDueFixtures({ league, lineup, clubId, config, now })

describe('the ladder', () => {
  it('labels tiers League 5 to League 1, then Prestige', () => {
    expect([1, 2, 3, 4, 5].map(tier => leagueLabel(tier))).toEqual([5, 4, 3, 2, 1].map(league => ({ kind: 'league', league })))
    expect(leagueLabel(6)).toEqual({ kind: 'prestige', level: 1 })
    expect(leagueLabel(8)).toEqual({ kind: 'prestige', level: 3 })
  })

  it('makes rivals 7 rating points stronger with every league', () => {
    expect(tierRating(2, config) - tierRating(1, config)).toBe(7)
    expect(tierRating(5, config) - tierRating(1, config)).toBe(28)
  })
})

describe('rivals', () => {
  it('are five clubs, the same five every time for a tier, with distinct names', () => {
    const rivals = generateRivals(1, config)
    expect(rivals).toHaveLength(5)
    expect(generateRivals(1, config)).toEqual(rivals)
    expect(new Set(rivals.map(rival => rival.name)).size).toBe(5)
  })

  it('spread around the tier\'s rating, strongest and weakest equally far from it', () => {
    const ratings = generateRivals(2, config).map(rival => rival.rating)
    expect(ratings[0]).toBe(tierRating(2, config) - config.league.rivalSpread)
    expect(ratings[4]).toBe(tierRating(2, config) + config.league.rivalSpread)
    expect(ratings[2]).toBe(tierRating(2, config))
  })

  it('get stronger up the ladder', () => {
    const mean = (tier: number) => generateRivals(tier, config).reduce((sum, rival) => sum + rival.att + rival.def, 0)
    expect(mean(2)).toBeGreaterThan(mean(1))
    expect(mean(5)).toBeGreaterThan(mean(4))
  })
})

describe('playing due fixtures', () => {
  const start = newLeagueState(T0, config)

  it('plays nothing before the first kick-off', () => {
    const result = play(start, average, T0 + 2 * HOUR)
    expect(result.results).toEqual([])
    expect(result.league).toEqual(start)
  })

  it('plays one match every three hours, in order, and sets the next kick-off', () => {
    const result = play(start, average, T0 + 10 * HOUR)
    expect(result.results.map(match => match.no)).toEqual([0, 1, 2])
    expect(result.results.map(match => match.kickoffAt)).toEqual([T0 + 3 * HOUR, T0 + 6 * HOUR, T0 + 9 * HOUR])
    expect(result.league.nextKickoffAt).toBe(T0 + 12 * HOUR)
    expect(result.league.fixtureNo).toBe(3)
  })

  it('plays each of the five rivals in turn', () => {
    const rivals = play(start, average, T0 + 15 * 3 * HOUR).results.map(match => match.rival.index)
    expect(rivals.slice(0, 5)).toEqual([0, 1, 2, 3, 4])
    expect(rivals.slice(5, 10)).toEqual([0, 1, 2, 3, 4])
  })

  it('pays something for every result: 3, 2 or 1 point, and 250 coins for a loss', () => {
    const results = play(start, average, T0 + 56 * 3 * HOUR).results
    for (const match of results) {
      expect(match.points).toBe(match.result === 'win' ? 3 : match.result === 'draw' ? 2 : 1)
      expect(match.coins).toBe(match.result === 'win' ? 600 : match.result === 'draw' ? 400 : 250)
    }
    expect(new Set(results.map(match => match.result)).size).toBeGreaterThan(1)
  })

  it('adds up the coins and points', () => {
    const result = play(start, average, T0 + 9 * HOUR)
    expect(result.coins).toBe(result.results.reduce((sum, match) => sum + match.coins, 0))
    expect(result.league.points).toBe(result.results.reduce((sum, match) => sum + match.points, 0))
  })

  it('catching up in pieces gives exactly the same results as all at once', () => {
    const rng = createRng('league-invariance')
    for (let run = 0; run < 25; run++) {
      // Below the catch-up cap (56 matches = 168h) nothing is skipped, so the split must not matter.
      const end = T0 + rng.int(1, 165) * HOUR
      const times = Array.from({ length: rng.int(1, 5) }, () => T0 + rng.int(0, end - T0)).sort((a, b) => a - b)

      let league = start
      const pieces = []
      for (const time of [...times, end]) {
        const part = play(league, average, time)
        pieces.push(...part.results)
        league = part.league
      }
      const once = play(start, average, end)

      expect(pieces).toEqual(once.results)
      expect(league).toEqual(once.league)
    }
  })

  it('gives the same results for the same club and different ones for another club', () => {
    const a = play(start, average, T0 + 30 * HOUR, 'club-a').results.map(match => [match.goalsFor, match.goalsAgainst])
    expect(play(start, average, T0 + 30 * HOUR, 'club-a').results.map(match => [match.goalsFor, match.goalsAgainst])).toEqual(a)
    expect(play(start, average, T0 + 30 * HOUR, 'club-b').results.map(match => [match.goalsFor, match.goalsAgainst])).not.toEqual(a)
  })

  it('uses the warm-up bonus for the first match only', () => {
    const result = play({ ...start, warmupBonus: 0.1 }, average, T0 + 9 * HOUR)
    expect(result.results.map(match => match.warmupBonus)).toEqual([0.1, 0, 0])
    expect(result.league.warmupBonus).toBe(0)
  })
})

describe('promotion', () => {
  it('moves up at 30 points, starts the new league on 0, and meets the new league\'s rivals', () => {
    const result = play(newLeagueState(T0, config), strong, T0 + 56 * 3 * HOUR)
    const promotion = result.results.find(match => match.promotedTo)
    expect(promotion).toBeDefined()
    expect(promotion!.promotedTo).toBe(2)
    const index = result.results.indexOf(promotion!)
    expect(result.results.slice(0, index + 1).reduce((sum, match) => sum + match.points, 0)).toBeGreaterThanOrEqual(30)
    expect(result.results[index + 1].tier).toBe(2)
    expect(result.results[index + 1].rival.rating).toBeGreaterThan(result.results[index].rival.rating - config.league.rivalSpread * 2 - 1)
    expect(result.league.tier).toBeGreaterThan(1)
  })

  it('keeps climbing past League 1 into Prestige', () => {
    const result = play({ ...newLeagueState(T0, config), tier: 5, points: 28 }, strong, T0 + 30 * HOUR)
    expect(result.results.some(match => match.promotedTo === 6)).toBe(true)
    expect(leagueLabel(result.league.tier).kind).toBe('prestige')
  })
})

describe('no relegation', () => {
  it('never goes back, however badly the team plays, and a loss still pays 1 point and 250 coins', () => {
    const result = play({ ...newLeagueState(T0, config), tier: 3 }, empty, T0 + 56 * 3 * HOUR)
    expect(result.results.every(match => match.result === 'loss')).toBe(true)
    expect(result.results.every(match => match.points === 1 && match.coins === 250)).toBe(true)
    expect(result.results.every(match => match.tier >= 3)).toBe(true)
    expect(result.league.tier).toBeGreaterThanOrEqual(3)
  })
})

describe('a long absence', () => {
  it('plays only the most recent matches up to the limit and does not pay for the rest', () => {
    const result = play(newLeagueState(T0, config), average, T0 + 30 * 24 * HOUR)
    expect(result.results).toHaveLength(config.league.maxCatchUpMatches)
    expect(result.skipped).toBeGreaterThan(0)
    expect(result.league.nextKickoffAt).toBeGreaterThan(T0 + 30 * 24 * HOUR)
    expect(result.league.nextKickoffAt - (T0 + 30 * 24 * HOUR)).toBeLessThanOrEqual(3 * HOUR)
    expect(result.league.fixtureNo).toBe(30 * 8)
  })
})

describe('the table', () => {
  it('has six rows with the club real points, sorted, and the same every time', () => {
    const result = play(newLeagueState(T0, config), average, T0 + 30 * HOUR)
    const table = leagueTable({ league: result.league, clubName: 'Harbour Town', clubId: 'club-1', config })
    expect(table).toHaveLength(6)
    expect(table.find(row => row.isClub)).toMatchObject({ name: 'Harbour Town', points: result.league.points, played: 10 })
    expect(table.every(row => row.played === 10)).toBe(true)
    expect(table.map(row => row.points)).toEqual([...table.map(row => row.points)].sort((a, b) => b - a))
    expect(leagueTable({ league: result.league, clubName: 'Harbour Town', clubId: 'club-1', config })).toEqual(table)
  })

  it('starts empty in a new tier', () => {
    const promoted = play(newLeagueState(T0, config), strong, T0 + 56 * 3 * HOUR)
    const fresh = { ...promoted.league, fixtureNo: promoted.league.tierStartNo! }
    expect(leagueTable({ league: { ...fresh, points: 0 }, clubName: 'Us', clubId: 'c', config }).every(row => row.points === 0 && row.played === 0)).toBe(true)
  })

  it('puts stronger rivals higher over a long run', () => {
    const long = { ...newLeagueState(T0, config), fixtureNo: 400 }
    const rivals = generateRivals(1, config)
    const table = leagueTable({ league: long, clubName: 'Us', clubId: 'c', config })
    const pointsOf = (index: number) => table.find(row => row.name === rivals[index].name)!.points
    expect(pointsOf(4)).toBeGreaterThan(pointsOf(0))
  })
})
