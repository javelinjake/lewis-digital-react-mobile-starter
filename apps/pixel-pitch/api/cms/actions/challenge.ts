import type { ActionContext } from '@ld/backend'
import type { AnyTaps, BoardEntry, ChallengeBoard, ChallengeEntry } from '@ld/pixel-pitch-core'
import type { Where } from 'payload'
import type { ChallengeEntry as EntryDoc } from '../../payload-types'
import { defineAction } from '@ld/backend'
import { challengeCabinet, claimWeekly, dayIndex, finishChallenge, startChallenge, weeklyTable, weekOf } from '@ld/pixel-pitch-core'
import { APIError } from 'payload'
import { serverNow } from '../game/clock'
import { loadGame } from '../game/load'
import { findClub, flowContext, mutateClub } from '../game/mutate-club'

// The daily challenge: one scored attempt a day at the day's game in endless mode, the same pattern for everyone,
// and the boards. A score is replayed by the server like any arcade play; one the rules think unlikely is kept off
// the boards until an admin has looked at it.

const limits = { rateLimit: { limit: 60, windowMs: 60_000 } }
const BOARD_SIZE = 100

/** Entries anyone may see: not flagged, or flagged and then passed by an admin. */
const onBoard: Where = { or: [{ flagged: { exists: false } }, { flagged: { equals: '' } }, { reviewed: { equals: true } }] }

export const startChallengeAction = defineAction({
  path: '/game/challenge/start',
  ...limits,
  handler: async ctx => ({ body: await mutateClub(ctx, input => startChallenge(flowContext(input))) }),
})

export const finishChallengeAction = defineAction({
  path: '/game/challenge/finish',
  ...limits,
  handler: async (ctx) => {
    const taps = ctx.body.taps
    if (!Array.isArray(taps))
      throw new APIError('Send taps: what the game recorded.', 400)
    const response = await mutateClub(ctx, input => finishChallenge(flowContext(input), taps as AnyTaps))
    // On the board, in the same transaction: one entry a club a day (the attempt was used when it started).
    await ctx.payload.create({
      collection: 'challenge-entries',
      data: {
        owner: Number(ctx.user.id),
        day: response.day,
        week: weekOf(response.day),
        cabinet: response.cabinet,
        score: response.score,
        clubName: response.club.name,
        crest: response.club.crest,
        kitPrimary: response.club.kitPrimary,
        kitSecondary: response.club.kitSecondary,
        flagged: response.flagged ?? undefined,
      },
      depth: 0,
      overrideAccess: true,
      req: ctx.req,
    })
    return { body: response }
  },
})

const toEntry = (doc: EntryDoc): ChallengeEntry & { owner: string } => ({ owner: String(typeof doc.owner === 'object' ? doc.owner.id : doc.owner), day: doc.day, score: doc.score })
const look = (doc: EntryDoc) => ({ clubName: doc.clubName, crest: doc.crest, kitPrimary: doc.kitPrimary, kitSecondary: doc.kitSecondary })

async function entries(ctx: ActionContext, where: Where): Promise<EntryDoc[]> {
  const result = await ctx.payload.find({ collection: 'challenge-entries', where, pagination: false, limit: 100_000, depth: 0, overrideAccess: true, req: ctx.req })
  return result.docs
}

/** A week's table, from the entries anyone may see, with each club's look from its latest entry. */
async function weekTable(ctx: ActionContext, week: number) {
  const docs = await entries(ctx, { and: [{ week: { equals: week } }, onBoard] })
  const game = await loadGame(ctx.payload)
  const latest = new Map<string, EntryDoc>()
  for (const doc of [...docs].sort((a, b) => a.day - b.day))
    latest.set(String(toEntry(doc).owner), doc)
  return { table: weeklyTable(docs.map(toEntry), game.config), latest }
}

/**
 * The boards: today's top 100 and where the caller stands (their own score shows even while held for review), and
 * this week's table. Everyone is on one board at launch; groups come when there are players to fill them.
 */
export const challengeBoardAction = defineAction({
  path: '/game/challenge/board',
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const now = serverNow(ctx.req)
    const game = await loadGame(ctx.payload)
    const club = await findClub(ctx)
    if (!club)
      throw new APIError('Create your club first.', 404, { code: 'no-club' }, true)
    const me = String(ctx.user.id)
    const day = dayIndex(now, game.config)
    const week = weekOf(day)

    const today = (await entries(ctx, { and: [{ day: { equals: day } }, onBoard] })).sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))
    const mine = (await entries(ctx, { and: [{ day: { equals: day } }, { owner: { equals: ctx.user.id } }] }))[0]
    const rankOf = (score: number) => today.filter(doc => doc.score > score).length + 1
    const daily: BoardEntry[] = today.slice(0, BOARD_SIZE).map(doc => ({ rank: rankOf(doc.score), ...look(doc), score: doc.score, you: toEntry(doc).owner === me }))

    const { table, latest } = await weekTable(ctx, week)
    const weekly: BoardEntry[] = table.slice(0, BOARD_SIZE).map((row, index) => ({ rank: index + 1, ...look(latest.get(row.owner)!), score: row.points, days: row.days, you: row.owner === me }))
    const myWeek = table.findIndex(row => row.owner === me)

    const board: ChallengeBoard = {
      day,
      week,
      cabinet: challengeCabinet(now, game.config),
      players: today.length,
      daily,
      you: mine ? { rank: rankOf(mine.score), score: mine.score, held: Boolean(mine.flagged) && !mine.reviewed } : null,
      weekly,
      weekPlayers: table.length,
      yourWeek: myWeek >= 0 ? { rank: myWeek + 1, score: table[myWeek].points, days: table[myWeek].days } : null,
    }
    return { body: board }
  },
})

/** Takes last week's reward, from the final table of that week. A week not played pays nothing but is marked taken. */
export const claimWeeklyAction = defineAction({
  path: '/game/challenge/weekly',
  ...limits,
  handler: async (ctx) => {
    const now = serverNow(ctx.req)
    const game = await loadGame(ctx.payload)
    const week = weekOf(dayIndex(now, game.config)) - 1
    const { table } = await weekTable(ctx, week)
    const index = table.findIndex(row => row.owner === String(ctx.user.id))
    const standing = index >= 0 ? { position: index + 1, players: table.length, days: table[index].days } : null
    return { body: await mutateClub(ctx, input => claimWeekly(flowContext(input), week, standing)) }
  },
})

export const challengeActions = [startChallengeAction, finishChallengeAction, challengeBoardAction, claimWeeklyAction]
