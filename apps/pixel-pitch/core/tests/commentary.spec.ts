import type { FixtureResult, LineupForMatch, MatchEvent } from '../src'
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
const chances = (moments: ReturnType<typeof report>) => moments.filter(moment => ['goal', 'save', 'miss'].includes(moment.kind))
const everything = (moments: ReturnType<typeof report>) => moments.flatMap(moment => [moment.setup, moment.outcome ?? ''])

/** A made-up match, to push the report past what real ones do. */
function synthetic(events: MatchEvent[]): FixtureResult {
  const ours = events.filter(event => event.kind === 'goal' && event.side === 'for').length
  const theirs = events.filter(event => event.kind === 'goal' && event.side === 'against').length
  return {
    ...fixtures[0],
    events,
    goalsFor: ours,
    goalsAgainst: theirs,
    result: ours > theirs ? 'win' : ours < theirs ? 'loss' : 'draw',
  }
}

describe('commentate', () => {
  it('is the same report for the same match and a different one for another seed', () => {
    const fixture = fixtures[3]
    expect(report(fixture, 'a')).toEqual(report(fixture, 'a'))
    expect(everything(report(fixture, 'a'))).not.toEqual(everything(report(fixture, 'b')))
  })

  it('opens with a kick-off, breaks for half-time at the half, and ends at full time on the final score', () => {
    for (const fixture of fixtures) {
      const moments = report(fixture)
      expect(moments[0]).toMatchObject({ kind: 'kickoff', minute: 0, score: [0, 0] })
      expect(moments.filter(moment => moment.kind === 'halftime')).toHaveLength(1)
      expect(moments.find(moment => moment.kind === 'halftime')!.minute).toBe(config.match.minutes / 2)
      expect(moments.at(-1)).toMatchObject({ kind: 'fulltime', minute: config.match.minutes, score: [fixture.goalsFor, fixture.goalsAgainst] })
      expect(moments.at(-1)!.setup).toContain(`${fixture.goalsFor}–${fixture.goalsAgainst}`)
    }
  })

  it('shows every goal, on the right side and minute, with the running score', () => {
    for (const fixture of fixtures) {
      const goals = report(fixture).filter(moment => moment.kind === 'goal')
      const expected = fixture.events.filter(event => event.kind === 'goal')
      expect(goals.map(moment => moment.side)).toEqual(expected.map(event => event.side))
      expect(goals.map(moment => moment.minute)).toEqual(expected.map(event => event.minute))
      let ours = 0
      let theirs = 0
      for (const goal of goals) {
        if (goal.side === 'for')
          ours++
        else theirs++
        expect(goal.score).toEqual([ours, theirs])
        expect(goal.outcome).toContain(`(${ours}–${theirs})`)
      }
    }
  })

  it('keeps only the big moments: a few chances, never more than the budget unless there are more goals', () => {
    for (const fixture of fixtures) {
      const moments = report(fixture)
      const goals = fixture.events.filter(event => event.kind === 'goal').length
      const shown = chances(moments).length
      expect(shown).toBeLessThanOrEqual(Math.max(config.match.report.maxMoments, goals))
      // A quiet match is topped up, so there is always something to read.
      expect(shown).toBeGreaterThanOrEqual(Math.max(config.match.report.minChances, goals))
      expect(moments.filter(moment => moment.kind === 'incident').length).toBeLessThanOrEqual(config.match.report.incidents)
      // Kick-off, half-time, full-time, the chances and the colour: a short read.
      expect(moments.length).toBeLessThanOrEqual(3 + Math.max(config.match.report.maxMoments, goals) + config.match.report.incidents)
    }
  })

  it('tops a quiet match up with chances that change nothing on the scoreboard', () => {
    const quiet = synthetic([{ minute: 12, side: 'for', kind: 'goal', slot: 2 }])
    for (let seed = 0; seed < 50; seed++) {
      const moments = report(quiet, seed)
      expect(chances(moments)).toHaveLength(config.match.report.minChances)
      expect(moments.filter(moment => moment.kind === 'goal')).toHaveLength(1)
      expect(moments.at(-1)!.score).toEqual([1, 0])
    }
  })

  it('drops the quietest chances first when a match has many events, but keeps every goal', () => {
    const many = synthetic(Array.from({ length: 16 }, (_, index) => ({
      minute: 2 + index * 2,
      side: index % 2 === 0 ? 'for' as const : 'against' as const,
      kind: index === 4 || index === 9 ? 'goal' as const : index % 3 === 0 ? 'save' as const : 'miss' as const,
      slot: 1 + (index % 4),
    })))
    for (let seed = 0; seed < 30; seed++) {
      const moments = report(many, seed)
      expect(moments.filter(moment => moment.kind === 'goal')).toHaveLength(2)
      expect(chances(moments)).toHaveLength(config.match.report.maxMoments)
    }
    const goalFest = synthetic(Array.from({ length: 9 }, (_, index) => ({ minute: 3 + index * 4, side: 'for' as const, kind: 'goal' as const, slot: 1 + (index % 4) })))
    expect(chances(report(goalFest, 1))).toHaveLength(9)
  })

  it('gives each chance a setup and an outcome, and the rest only a setup', () => {
    for (const fixture of fixtures) {
      for (const moment of report(fixture)) {
        expect(moment.setup.length).toBeGreaterThan(10)
        if (['goal', 'save', 'miss'].includes(moment.kind))
          expect(moment.outcome?.length ?? 0).toBeGreaterThan(10)
        else
          expect(moment.outcome).toBeNull()
      }
    }
  })

  it('is in time order and stays inside the match', () => {
    for (const fixture of fixtures) {
      const minutes = report(fixture).map(moment => moment.minute)
      expect(minutes).toEqual([...minutes].sort((a, b) => a - b))
      expect(Math.min(...minutes)).toBe(0)
      expect(Math.max(...minutes)).toBe(config.match.minutes)
    }
  })

  it('names players of the squads in a chance, and never has the attacking side\'s keeper shoot', () => {
    for (const fixture of fixtures) {
      for (const moment of chances(report(fixture))) {
        const attackers = moment.side === 'for' ? fixture.squads.ours : fixture.squads.theirs
        const defenders = moment.side === 'for' ? fixture.squads.theirs : fixture.squads.ours
        const text = `${moment.setup} ${moment.outcome}`
        expect([...attackers, ...defenders].some(name => text.includes(name))).toBe(true)
        const roles = FORMATIONS[moment.side === 'for' ? fixture.formation : fixture.rival.formation].roles
        expect(text).not.toContain(attackers[roles.indexOf('GK')])
      }
    }
    expect(fixtures[0].squads.ours).toEqual(NAMES)
    expect(new Set(fixtures[0].squads.theirs).size).toBe(5)
  })

  it('has plenty of variety across matches, and no line repeated inside one', () => {
    const all = fixtures.flatMap(fixture => everything(report(fixture)))
    expect(new Set(all).size).toBeGreaterThan(150)
    for (const fixture of fixtures) {
      const lines = everything(report(fixture)).filter(Boolean)
      expect(new Set(lines).size).toBe(lines.length)
    }
  })

  it('draws on a wide list of goals, saves, misses and colour over many matches', () => {
    const goalMatch = synthetic([
      { minute: 8, side: 'for', kind: 'goal', slot: 3 },
      { minute: 14, side: 'against', kind: 'goal', slot: 4 },
      { minute: 22, side: 'for', kind: 'goal', slot: 1 },
      { minute: 27, side: 'for', kind: 'save', slot: 2 },
      { minute: 31, side: 'against', kind: 'miss', slot: 3 },
      { minute: 36, side: 'for', kind: 'miss', slot: 4 },
    ])
    // Count lines as templates: with the player and team names taken out, so a new name is not a new line.
    const names = [...goalMatch.squads.ours, ...goalMatch.squads.theirs, 'Harbour Town', goalMatch.rival.name]
    const plain = (text: string) => names.reduce((result, name) => result.replaceAll(name, '·'), text)
    const seen = { goalSetups: new Set<string>(), goalFinishes: new Set<string>(), saves: new Set<string>(), misses: new Set<string>(), incidents: new Set<string>() }
    let goals = 0
    let ownGoals = 0
    for (let seed = 0; seed < 500; seed++) {
      for (const moment of report(goalMatch, seed)) {
        if (moment.kind === 'goal') {
          goals++
          seen.goalSetups.add(plain(moment.setup))
          // The opener and the score context change the line; the finish is what is in the middle.
          seen.goalFinishes.add(plain(moment.outcome!.replace(/^[^.!]*[.!]\s/, '').replace(/\s\(\d+–\d+\)$/, '')))
          if (/own goal|their own net/i.test(moment.outcome!))
            ownGoals++
        }
        if (moment.kind === 'save')
          seen.saves.add(plain(moment.outcome!))
        if (moment.kind === 'miss')
          seen.misses.add(plain(moment.outcome!))
        if (moment.kind === 'incident')
          seen.incidents.add(plain(moment.setup))
      }
    }
    expect(seen.goalSetups.size).toBeGreaterThanOrEqual(36)
    expect(seen.goalFinishes.size).toBeGreaterThanOrEqual(36)
    expect(seen.saves.size).toBeGreaterThanOrEqual(14)
    expect(seen.misses.size).toBeGreaterThanOrEqual(19)
    expect(seen.incidents.size).toBeGreaterThanOrEqual(9)
    // An own goal is rare, but it does happen.
    expect(ownGoals).toBeGreaterThan(0)
    expect(ownGoals / goals).toBeLessThan(0.1)
  })

  it('reads like 5-a-side: kick-ins and corners, never throw-ins or offside', () => {
    const text = fixtures.flatMap(fixture => everything(report(fixture))).join(' ').toLowerCase()
    expect(text).toContain('kick-in')
    expect(text).toContain('corner')
    expect(text).not.toContain('throw-in')
    expect(text).not.toMatch(/offside|wing-back|centre-half|penalty spot|extra time/)
  })

  it('does not leave a template placeholder or a name gap behind', () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const fixture of fixtures.slice(0, 6)) {
        for (const text of everything(report(fixture, seed))) {
          expect(text).not.toMatch(/\{|\}|undefined|\bnull\b/)
          expect(text).not.toMatch(/\s{2,}/)
        }
      }
    }
  })

  it('copes with an empty lineup: the missing players are trialists', () => {
    const empty: LineupForMatch = { formation: '3-1', players: [null, null, null, null, null] }
    const [fixture] = playDueFixtures({ league: newLeagueState(T0, config), lineup: empty, clubId: 'club-e', config, now: T0 + 3 * HOUR }).results
    expect(fixture.squads.ours.every(name => name === 'A trialist')).toBe(true)
    expect(report(fixture).at(-1)!.kind).toBe('fulltime')
  })
})
