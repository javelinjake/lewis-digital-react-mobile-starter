import type { BoardEntry, ChallengeBoard, ChallengeEntry, GameConfig, GameResponse } from '@ld/pixel-pitch-core'
import { challengeCabinet, dayIndex, NATIONS, weeklyTable, weekOf } from '@ld/pixel-pitch-core'
import { createRng, hashSeed } from '@ld/utils/random/rng'

// The daily challenge boards for the mock api (development, Playwright, the offline playtest build), where there is
// no one else to play against. A dozen made-up clubs post scores near the day's targets, the same every time for a
// day, so the boards have something on them. They are clearly not real players and never reach a real server.

export interface MockEntry {
  day: number
  score: number
}

const BOTS = 12
const SUFFIXES = ['Athletic', 'Rovers', 'Town', 'Albion', 'Wanderers', 'City']

function bots(day: number, config: GameConfig, now: number) {
  const rng = createRng(hashSeed('mock-board', day))
  const [, silver, gold] = config.challenge.targets[challengeCabinet(now, config)]
  return Array.from({ length: BOTS }, (_, index) => ({
    owner: `bot-${index}`,
    clubName: `${NATIONS[index % NATIONS.length]} ${SUFFIXES[index % SUFFIXES.length]} (test)`,
    crest: index * 3 % 32,
    kitPrimary: ['#3f7fd6', '#d03a2f', '#3fa34d', '#f2a33a'][index % 4],
    kitSecondary: '#f4f4f4',
    day,
    score: Math.round(rng.next() * (gold + silver) / 1.5),
  }))
}

export function mockBoard(game: GameResponse, mine: readonly MockEntry[], config: GameConfig, now: number): ChallengeBoard {
  const day = dayIndex(now, config)
  const week = weekOf(day)
  const club = game.club
  const look = { clubName: club.name, crest: club.crest, kitPrimary: club.kitPrimary, kitSecondary: club.kitSecondary }
  const today = mine.find(entry => entry.day === day)
  const dayRows = [...bots(day, config, now), ...(today ? [{ owner: 'you', ...look, day, score: today.score }] : [])].sort((a, b) => b.score - a.score)
  const rankOf = (score: number) => dayRows.filter(row => row.score > score).length + 1
  const daily: BoardEntry[] = dayRows.map(row => ({ rank: rankOf(row.score), clubName: row.clubName, crest: row.crest, kitPrimary: row.kitPrimary, kitSecondary: row.kitSecondary, score: row.score, you: row.owner === 'you' }))

  const days = Array.from({ length: 7 }, (_, offset) => week * 7 + offset).filter(each => each <= day)
  const entries: ChallengeEntry[] = [
    ...days.flatMap(each => bots(each, config, now)),
    ...mine.filter(entry => weekOf(entry.day) === week).map(entry => ({ owner: 'you', day: entry.day, score: entry.score })),
  ]
  const table = weeklyTable(entries, config)
  const names = new Map(bots(day, config, now).map(bot => [bot.owner, bot]))
  const weekly: BoardEntry[] = table.map((row, index) => {
    const who = row.owner === 'you' ? look : names.get(row.owner)!
    return { rank: index + 1, clubName: who.clubName, crest: who.crest, kitPrimary: who.kitPrimary, kitSecondary: who.kitSecondary, score: row.points, days: row.days, you: row.owner === 'you' }
  })
  const yours = table.findIndex(row => row.owner === 'you')
  return {
    day,
    week,
    cabinet: challengeCabinet(now, config),
    players: dayRows.length,
    daily,
    you: today ? { rank: rankOf(today.score), score: today.score, held: false } : null,
    weekly,
    weekPlayers: table.length,
    yourWeek: yours >= 0 ? { rank: yours + 1, score: table[yours].points, days: table[yours].days } : null,
  }
}

/** Where the player finished a past week, against the made-up clubs. */
export function mockWeekStanding(mine: readonly MockEntry[], week: number, config: GameConfig) {
  const days = Array.from({ length: 7 }, (_, offset) => week * 7 + offset)
  const entries: ChallengeEntry[] = [
    ...days.flatMap(day => bots(day, config, day * 24 * 60 * 60_000 + config.daily.dayStartOffsetMinutes * 60_000)),
    ...mine.filter(entry => weekOf(entry.day) === week).map(entry => ({ owner: 'you', day: entry.day, score: entry.score })),
  ]
  const table = weeklyTable(entries, config)
  const index = table.findIndex(row => row.owner === 'you')
  return index >= 0 ? { position: index + 1, players: table.length, days: table[index].days } : null
}
