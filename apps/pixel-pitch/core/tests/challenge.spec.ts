import type { AnyTaps, ClubState, FlowContext } from '../src'
import { describe, expect, it } from 'vitest'
import { CABINETS, challengeCabinet, claimWeekly, dayIndex, DEFAULT_CONFIG, endlessMinigames, finishChallenge, FOOTBALLERS, hotCabinet, isGameRuleError, judgeEntry, kickPoints, kickRounds, markerAt, newClubState, perfectTaps, playConfig, scoreKeeper, scoreKick, scorePenalties, scorePlay, startChallenge, targetAt, weekOf, weekToClaim, weeklyBand, weeklyTable } from '../src'

const config = DEFAULT_CONFIG
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const T0 = Date.UTC(2026, 10, 12, 12)
const byId = new Map(FOOTBALLERS.map(player => [player.id, player]))
const context = (state: ClubState, now = T0, clubId: string | number = 'club-1'): FlowContext => ({ state, cards: [], catalogue: FOOTBALLERS, players: id => byId.get(id), config, clubId, now })
const code = (run: () => unknown) => {
  try {
    run()
    return 'accepted'
  }
  catch (error) {
    return isGameRuleError(error) ? error.code : 'other'
  }
}
const endless = { ...config, minigames: endlessMinigames(config) }

describe('endless mode', () => {
  it('stops at the first fail, and refuses a play that went on after one or stopped while still in', () => {
    const seed = 'endless-1'
    const perfect = perfectTaps('kick', seed, endless) as number[]
    expect(perfect).toHaveLength(config.challenge.endless.kickRounds)
    // A kick tapped far off the target ends it.
    const bar = kickRounds(seed, endless)[6]
    const missAt = (_round: number) => {
      for (let ms = 150; ms < 8000; ms += 7) {
        if (kickPoints(Math.abs(markerAt(bar, ms) - targetAt(bar, ms)), endless, bar.zone) === 0)
          return ms
      }
      throw new Error('no miss')
    }
    const ended = [...perfect.slice(0, 6), missAt(6)]
    const score = scoreKick(seed, ended, endless)
    expect(score.points.slice(0, 6).every(points => points > 0)).toBe(true)
    expect(score.total).toBeGreaterThan(0)
    expect(() => scoreKick(seed, perfect.slice(0, 6), endless)).toThrow('until a fail')
    expect(() => scoreKick(seed, [...ended, perfect[7]], endless)).toThrow('first fail')
  })

  it('makes the kicks quicker every round, past anyone\'s reactions', () => {
    const rounds = endless.minigames.kick
    expect(rounds.ramp).toBeGreaterThan(0)
    expect(rounds.rounds).toBe(80)
  })

  it('ends Keeper Reflex at the first goal and the penalties at the first one not scored', () => {
    expect(scoreKeeper('k', [null], endless).total).toBe(0)
    expect(() => scoreKeeper('k', [null, null], endless)).toThrow()
    const pens = perfectTaps('pens', 'p', endless) as number[]
    expect(scorePenalties('p', pens, endless).total).toBe(pens.length * 2)
  })
})

describe('the daily challenge', () => {
  it('is the day\'s featured game, the same pattern for every player, and once a day', () => {
    const one = startChallenge(context(newClubState(T0, config))).state
    const two = startChallenge(context(newClubState(T0, config), T0, 'club-2')).state
    expect(one.ticket).toMatchObject({ kind: 'challenge', cabinet: hotCabinet(T0, config), tier: 1 })
    expect(one.ticket!.seed).toBe(two.ticket!.seed)
    expect(code(() => startChallenge(context(one)))).toBe('played')
    expect(code(() => startChallenge(context(one, T0 + DAY)))).toBe('accepted')
    expect(new Set(Array.from({ length: 5 }, (_, day) => challengeCabinet(T0 + day * DAY, config)))).toEqual(new Set(CABINETS))
  })

  it('pays tokens for taking part and each target beaten, and records the score', () => {
    // A Keeper Reflex day: seven saves, then one goes in.
    const at = [0, 1, 2, 3, 4].map(day => T0 + day * DAY).find(time => challengeCabinet(time, config) === 'keeper')!
    const started = startChallenge(context(newClubState(at, config), at)).state
    const ticket = started.ticket!
    const tuned = playConfig(config, ticket)
    const taps = [...(perfectTaps('keeper', ticket.seed, tuned) as unknown[]).slice(0, 7), null] as AnyTaps
    const { score } = scorePlay(ticket.cabinet!, ticket.seed, taps, tuned)
    expect(score).toBe(7)
    const done = finishChallenge(context(started, at + 9 * MINUTE), taps)
    const targets = config.challenge.targets[ticket.cabinet!]
    expect(done.extra).toMatchObject({ day: dayIndex(at, config), score, tokens: 25, medals: ['bronze'] })
    expect(done.extra!.medals).toHaveLength(targets.filter(target => score >= target).length)
    expect(done.state.tokens).toBe(25)
    expect(done.state.coins).toBe(400)
    expect(done.state.challenge).toMatchObject({ day: dayIndex(at, config), score })
    expect(done.state.ticket).toBeNull()
  })

  it('holds a score above the ceiling or taps too even', () => {
    expect(judgeEntry('kick', config.challenge.ceiling.kick + 1, [], config)).toBe('above-ceiling')
    const even = Array.from({ length: 20 }, (_, index) => ({ ms: index * 400, lane: index % 2 === 0 ? 0 : 1 }))
    expect(judgeEntry('dribble', 10, even, config)).toBe('too-regular')
    const human = even.map((move, index) => ({ ...move, ms: move.ms + (index * 37 % 90) }))
    expect(judgeEntry('dribble', 10, human, config)).toBeNull()
  })
})

describe('the week', () => {
  it('turns each day into 0 to 100 by position and counts the best five days', () => {
    const entries = [
      ...[0, 1, 2, 3, 4, 5, 6].map(day => ({ owner: 'a', day, score: 10 })),
      ...[0, 1, 2, 3, 4, 5, 6].map(day => ({ owner: 'b', day, score: day === 0 ? 50 : 5 })),
      { owner: 'c', day: 0, score: 1 },
    ]
    const table = weeklyTable(entries, config)
    expect(table[0]).toEqual({ owner: 'a', days: 7, points: 500 })
    expect(table.find(row => row.owner === 'b')).toMatchObject({ days: 7, points: 100 })
  })

  it('pays one band, the best reached, and a missed week nothing', () => {
    expect(weeklyBand(2, 100, 7, config)?.id).toBe('top3')
    expect(weeklyBand(8, 100, 7, config)?.id).toBe('top10')
    expect(weeklyBand(40, 100, 7, config)?.id).toBe('tophalf')
    expect(weeklyBand(90, 100, 3, config)?.id).toBe('played')
    expect(weeklyBand(90, 100, 2, config)).toBeNull()
  })

  it('says a week is waiting only when the club played in it', () => {
    const played = startChallenge(context(newClubState(T0, config))).state
    const nextWeek = (weekOf(dayIndex(T0, config)) + 1) * 7 * DAY + DAY / 2
    expect(weekToClaim(played, nextWeek, config)).toBe(weekOf(dayIndex(T0, config)))
    expect(weekToClaim(newClubState(T0, config), nextWeek, config)).toBeNull()
    expect(weekToClaim(played, T0, config)).toBeNull()
  })

  it('is claimed once, after the week is over, and the podium badge is kept', () => {
    const week = weekOf(dayIndex(T0, config))
    const state = newClubState(T0, config)
    expect(code(() => claimWeekly(context(state), week, { position: 1, players: 10, days: 5 }))).toBe('week-open')
    const later = T0 + 8 * DAY
    const claimed = claimWeekly(context(state, later), week, { position: 1, players: 10, days: 5 })
    expect(claimed.extra).toMatchObject({ band: 'top3', badge: 'challenge-podium' })
    expect(claimed.state.starPacks).toBe(1)
    expect(claimed.state.badges).toEqual(['challenge-podium'])
    expect(code(() => claimWeekly(context(claimed.state, later), week, null))).toBe('claimed')
  })
})
