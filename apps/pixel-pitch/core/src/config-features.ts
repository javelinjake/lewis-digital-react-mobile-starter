import type { Reward } from './config-rewards'
import { z } from 'zod'
import { rewardSchema } from './config-rewards'

// The schemas of the newer systems (match moments, mastery, the daily challenge, Prestige) and their
// defaults, kept apart from `config.ts` so neither file grows too long. `gameConfigSchema` uses them.

const positive = z.number().positive()
const count = z.number().int().nonnegative()



/** Bronze, silver and gold, each a share (0 to 1) of the game's top score, rising. */
const medalShares = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)])

type Shares = [number, number, number]

/** Bronze, silver and gold scores, rising. */
const medalScores = z.tuple([count, count, count])

export const DEFAULT_CHALLENGE = {
  endless: { kickRounds: 80, kickRamp: 0.07, pensRounds: 80, pensLastPace: 0.12, keeperShots: 80, keeperLastWindowMs: 110, keepySeconds: 300, dribbleDefenders: 400, dribbleLastGapMs: 120, dribbleLastFallMs: 240 },
  tokens: 25,
  targets: { kick: [12, 30, 60], keepy: [15, 30, 50], pens: [4, 10, 20], keeper: [5, 12, 20], dribble: [15, 35, 60] } as Record<'kick' | 'keepy' | 'pens' | 'keeper' | 'dribble', Shares>,
  rewards: { bronze: { kind: 'coins', amount: 400 }, silver: { kind: 'tokens', amount: 60 }, gold: { kind: 'gems', amount: 10 } } as Record<'bronze' | 'silver' | 'gold', Reward>,
  ceiling: { kick: 300, keepy: 250, pens: 110, keeper: 70, dribble: 260 },
  regularity: 0.03,
  regularityMinTaps: 8,
  bestDays: 5,
  weekly: [
    { id: 'top3', label: 'Top 3', top: 3, rewards: [{ kind: 'starPacks', amount: 1 }], badge: 'challenge-podium' },
    { id: 'top10', label: 'Top 10%', share: 0.1, rewards: [{ kind: 'starPacks', amount: 1 }, { kind: 'gems', amount: 30 }] },
    { id: 'tophalf', label: 'Top half', share: 0.5, rewards: [{ kind: 'gems', amount: 20 }, { kind: 'packs', amount: 1 }] },
    { id: 'played', label: 'Played 3 days', days: 3, rewards: [{ kind: 'packs', amount: 1 }] },
  ] as Array<{ id: string, label: string, top?: number, share?: number, days?: number, rewards: Reward[], badge?: string }>,
}
export const DEFAULT_MASTERY: { shares: Record<'kick' | 'keepy' | 'pens' | 'keeper' | 'dribble', Shares>, rewards: Record<'bronze' | 'silver' | 'gold', Reward> } = {
  shares: { kick: [0.4, 0.65, 0.85], keepy: [0.3, 0.55, 0.8], pens: [0.4, 0.6, 0.8], keeper: [0.5, 0.7, 0.9], dribble: [0.3, 0.55, 0.8] },
  rewards: { bronze: { kind: 'coins', amount: 500 }, silver: { kind: 'tokens', amount: 80 }, gold: { kind: 'gems', amount: 15 } },
}


/**
 * Match moments: one penalty, free kick or save, played with an arcade game. A Big Chance is banked from a league
 * match the player missed that ended in a draw or a one-goal loss; a live moment is offered in a match the player
 * watches. Scoring one moves the result up. PLACEHOLDERS, to tune in playtest.
 */
export const momentsSchema = z.object({
  /** Big Chances kept at once. When full, the newest replaces the oldest. */
  bank: z.number().int().min(1),
  /** A match that kicked off at most this long before the player looked in was watched: it gets a live moment. */
  liveWindowMinutes: positive,
  /** How long the live moment waits for the player before it counts as a miss (the app's countdown). */
  decideSeconds: positive,
  /** Kick Timer points a free kick needs to go in (3 is the very middle). */
  freeKickPoints: z.number().int().min(1).max(3),
}).default({ bank: 5, liveWindowMinutes: 5, decideSeconds: 10, freeKickPoints: 2 })

/**
 * Mastery: bronze, silver and gold in each arcade game in each league, as shares of the game's top score. The games
 * are quicker each league, so the same share is harder higher up. The first time each medal is earned it pays once.
 * PLACEHOLDERS.
 */
export const masterySchema = z.object({
  shares: z.object({ kick: medalShares, keepy: medalShares, pens: medalShares, keeper: medalShares, dribble: medalShares }),
  rewards: z.object({ bronze: rewardSchema, silver: rewardSchema, gold: rewardSchema }),
}).default(DEFAULT_MASTERY)

/**
 * The daily challenge: every player gets the day's featured game in endless mode, with the same pattern, once a day.
 * PLACEHOLDERS, to tune in playtest.
 */
export const challengeSchema = z.object({
  /** How endless each game is: rounds before it runs out (nobody should get there) and how fast it gets. */
  endless: z.object({
    kickRounds: z.number().int().positive(),
    kickRamp: z.number().min(0).max(1),
    pensRounds: z.number().int().positive(),
    pensLastPace: z.number().min(0.05).max(1),
    keeperShots: z.number().int().positive(),
    keeperLastWindowMs: positive,
    keepySeconds: positive,
    dribbleDefenders: z.number().int().positive(),
    dribbleLastGapMs: positive,
    dribbleLastFallMs: positive,
  }),
  /** Tokens just for taking part. */
  tokens: count,
  /** Bronze, silver and gold scores for each game, and what beating each pays (once a day). */
  targets: z.object({ kick: medalScores, keepy: medalScores, pens: medalScores, keeper: medalScores, dribble: medalScores }),
  rewards: z.object({ bronze: rewardSchema, silver: rewardSchema, gold: rewardSchema }),
  /** A score above this is held off the boards until someone looks at it. */
  ceiling: z.object({ kick: count, keepy: count, pens: count, keeper: count, dribble: count }),
  /**
   * Taps this even are held too: the spread of the gaps between taps, as a share of their average, under this.
   * A person's timing wobbles; a script's does not. Only plays with at least `regularityMinTaps` taps are judged.
   */
  regularity: z.number().min(0).max(1),
  regularityMinTaps: z.number().int().min(3),
  /** Days in a week that count towards its score: the best ones. */
  bestDays: z.number().int().min(1).max(7),
  /** Weekly rewards, best band first; each player gets the first they reach. Bands do not stack. */
  weekly: z.array(z.object({
    id: z.string(),
    label: z.string(),
    /** Reached by finishing in the top `top` places, or the top `share` of players (0.1 is 10%), or playing `days` days. */
    top: count.optional(),
    share: z.number().min(0).max(1).optional(),
    days: z.number().int().min(1).max(7).optional(),
    rewards: z.array(rewardSchema),
    /** A cosmetic badge for the club, kept for good. */
    badge: z.string().optional(),
  })),
}).default(DEFAULT_CHALLENGE)

/**
 * Prestige: every tier past League 1 is another league with a higher gate and stronger rivals. Each one reached is
 * for good: a star on the crest, a line in the trophy cabinet, and a small permanent bonus. Nothing is ever reset.
 */
export const prestigeSchema = z.object({
  /** More coins from league matches and the stadium for each Prestige tier reached (0.02 is +2%). PLACEHOLDER. */
  coinBonusPerTier: z.number().min(0).max(0.5),
}).default({ coinBonusPerTier: 0.02 })

