import type { FixtureResult, LineupForMatch } from '../src'
import { describe, expect, it } from 'vitest'
import { commentate, DEFAULT_CONFIG, FORMATIONS, newLeagueState, playDueFixtures } from '../src'

const config = DEFAULT_CONFIG
const HOUR = 60 * 60 * 1000
const T0 = Date.UTC(2026, 10, 8, 12)

const NAMES = ['Giralda Vance', 'Zafiro Quill', 'Bellavista Rook', 'Thistledown Park', 'Castellan Moor']
const lineup: LineupForMatch = {
  formation: '2-2',
  players: FORMATIONS['2-2'].roles.map((role, index) => ({ position: role, rating: 62, nation: index % 4 })),
  names: NAMES,
}

/** A season's worth of real fixtures, so the tests see the variety a player would. */
const fixtures: FixtureResult[] = playDueFixtures({ league: newLeagueState(T0, config), lineup, clubId: 'club-c', config, now: T0 + 60 * 3 * HOUR }).results
const report = (fixture: FixtureResult, seed: string | number = fixture.no) => commentate({ clubName: 'Harbour Town', fixture, config, seed })

describe('commentate', () => {
  it('is the same report for the same match and a different one for another seed', () => {
    const fixture = fixtures[3]
    expect(report(fixture, 'a')).toEqual(report(fixture, 'a'))
    expect(report(fixture, 'a').map(line => line.text)).not.toEqual(report(fixture, 'b').map(line => line.text))
  })

  it('opens with a kick-off, breaks for half-time at the half, and ends at full time on the final score', () => {
    for (const fixture of fixtures) {
      const lines = report(fixture)
      expect(lines[0]).toMatchObject({ kind: 'kickoff', minute: 0, score: [0, 0] })
      expect(lines.filter(line => line.kind === 'halftime')).toHaveLength(1)
      expect(lines.find(line => line.kind === 'halftime')!.minute).toBe(config.match.minutes / 2)
      expect(lines.at(-1)).toMatchObject({ kind: 'fulltime', minute: config.match.minutes, score: [fixture.goalsFor, fixture.goalsAgainst] })
      expect(lines.at(-1)!.text).toContain(`${fixture.goalsFor}–${fixture.goalsAgainst}`)
    }
  })

  it('agrees with the match: one goal line per goal, on the right side, with the running score', () => {
    for (const fixture of fixtures) {
      const lines = report(fixture)
      const goals = lines.filter(line => line.kind === 'goal')
      const expected = fixture.events.filter(event => event.kind === 'goal')
      expect(goals.map(line => line.side)).toEqual(expected.map(event => event.side))
      expect(goals.map(line => line.minute)).toEqual(expected.map(event => event.minute))
      let ours = 0
      let theirs = 0
      for (const goal of goals) {
        if (goal.side === 'for')
          ours++
        else theirs++
        expect(goal.score).toEqual([ours, theirs])
        expect(goal.text).toContain(`(${ours}–${theirs})`)
      }
      expect(lines.filter(line => line.kind === 'save')).toHaveLength(fixture.events.filter(event => event.kind === 'save').length)
      expect(lines.filter(line => line.kind === 'miss')).toHaveLength(fixture.events.filter(event => event.kind === 'miss').length)
    }
  })

  it('is in time order and stays inside the match', () => {
    for (const fixture of fixtures) {
      const minutes = report(fixture).map(line => line.minute)
      expect(minutes).toEqual([...minutes].sort((a, b) => a - b))
      expect(Math.min(...minutes)).toBe(0)
      expect(Math.max(...minutes)).toBe(config.match.minutes)
    }
  })

  it('names the players of the right squad: our scorer is ours, theirs is one of the rival\'s', () => {
    for (const fixture of fixtures) {
      for (const line of report(fixture).filter(entry => entry.kind === 'goal')) {
        const names = line.side === 'for' ? fixture.squads.ours : fixture.squads.theirs
        expect(names.some(name => line.text.includes(name))).toBe(true)
      }
    }
    expect(fixtures[0].squads.ours).toEqual(NAMES)
    expect(new Set(fixtures[0].squads.theirs).size).toBe(5)
  })

  it('never lets a goalkeeper score or take a shot', () => {
    for (const fixture of fixtures) {
      for (const side of ['for', 'against'] as const) {
        const roles = FORMATIONS[side === 'for' ? fixture.formation : fixture.rival.formation].roles
        const keeper = (side === 'for' ? fixture.squads.ours : fixture.squads.theirs)[roles.indexOf('GK')]
        const attacking = report(fixture).filter(line => line.side === side && ['goal', 'miss'].includes(line.kind))
        for (const line of attacking)
          expect(line.text.startsWith(keeper) || line.text.includes(`${keeper} drills`) || line.text.includes(`${keeper} lifts`)).toBe(false)
      }
    }
  })

  it('has plenty of variety: many different lines across matches, and few repeats inside one', () => {
    const all = fixtures.flatMap(fixture => report(fixture).map(line => line.text))
    expect(new Set(all).size).toBeGreaterThan(150)
    for (const fixture of fixtures) {
      const lines = report(fixture).map(line => line.text)
      const unique = new Set(lines).size
      expect(unique).toBeGreaterThanOrEqual(lines.length - 2)
    }
  })

  it('is a good length to read in about 20 seconds: 15 to 45 lines', () => {
    for (const fixture of fixtures) {
      const count = report(fixture).length
      expect(count).toBeGreaterThanOrEqual(15)
      expect(count).toBeLessThanOrEqual(45)
    }
  })

  it('reads like 5-a-side: kick-ins and corners, never throw-ins or offside', () => {
    const text = fixtures.flatMap(fixture => report(fixture).map(line => line.text)).join(' ').toLowerCase()
    expect(text).toContain('kick-in')
    expect(text).toContain('corner')
    expect(text).not.toContain('throw-in')
    expect(text).not.toMatch(/offside|wing-back|centre-half|penalty spot|extra time/)
  })

  it('does not leave a template placeholder or a name gap behind', () => {
    for (const fixture of fixtures) {
      for (const line of report(fixture)) {
        expect(line.text).not.toMatch(/\{|\}|undefined|\bnull\b/)
        expect(line.text).not.toMatch(/\s{2,}/)
      }
    }
  })

  it('copes with an empty lineup: the missing players are trialists', () => {
    const empty: LineupForMatch = { formation: '3-1', players: [null, null, null, null, null] }
    const [fixture] = playDueFixtures({ league: newLeagueState(T0, config), lineup: empty, clubId: 'club-e', config, now: T0 + 3 * HOUR }).results
    expect(fixture.squads.ours.every(name => name === 'A trialist')).toBe(true)
    const lines = report(fixture)
    expect(lines.at(-1)!.kind).toBe('fulltime')
  })
})
