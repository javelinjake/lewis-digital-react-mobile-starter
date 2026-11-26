import { z } from 'zod'

// The arcade games' and the warm-up's numbers, kept apart from the rest of the config because there are many.

const positive = z.number().positive()

/** Tuning of the arcade games and the warm-up. PLACEHOLDERS: balance in the first playtest. */
export const minigamesSchema = z.object({
  /** A tap sooner than this after the last one is not a person. */
  minTapGapMs: positive,
  /** The server's clock must have run at least this fraction of the play's own length (leaves room for latency). */
  clockSlack: z.number().min(0.5).max(1),
  kick: z.object({
    rounds: z.number().int().positive(),
    /** Bar crossings a second, per round: between these two. */
    minSpeed: positive,
    maxSpeed: positive,
    /** Half-widths of the scoring zones, as a fraction of the bar: 3, 2 and 1 point. */
    perfect: positive,
    good: positive,
    ok: positive,
    /** A fast round: the marker is this many times quicker. */
    fastFactor: positive.default(1.4),
    /** A narrow round: the zones are this fraction of their usual width. */
    narrowZone: positive.default(0.6),
    /** A moving round: the target swings this far either side of its middle, as a fraction of the bar. */
    drift: z.number().min(0).max(0.3).default(0.14),
  }),
  /** Penalty Shootout: five penalties, an aim sweeping across the goal and a keeper shuffling along the line. */
  pens: z.object({
    rounds: z.number().int().positive(),
    aimMinSpeed: positive,
    aimMaxSpeed: positive,
    keeperMinSpeed: positive,
    keeperMaxSpeed: positive,
    /** The posts: an aim closer to the edge than this (a fraction of the width) is wide. */
    post: z.number().min(0).max(0.3),
    /** An aim this close to a post is in the corner, worth 2. */
    corner: z.number().min(0).max(0.5),
    /** The keeper saves anything within this of where they stand. */
    reach: positive,
  }).default({ rounds: 5, aimMinSpeed: 0.9, aimMaxSpeed: 1.6, keeperMinSpeed: 0.35, keeperMaxSpeed: 0.8, post: 0.1, corner: 0.28, reach: 0.12 }),
  keepy: z.object({
    /** Gravity at the start, in pitch units a second squared; the ball is 100 units from the ground up to the top. */
    gravity: positive,
    /** How much harder it gets with each kick: gravity grows by this fraction. */
    ramp: z.number().nonnegative(),
    /** A kick lands the ball between these heights. */
    minPeak: positive,
    maxPeak: positive,
    /** The foot reaches the ball when it is this low and falling. */
    reach: positive,
    /** After a badly timed tap the player cannot kick for this many 60 Hz steps. */
    stumbleSteps: z.number().int().nonnegative(),
    /** The game ends at this many kicks. */
    maxKicks: z.number().int().positive(),
    /** And at this many seconds, whatever the score: a play is short. */
    maxSeconds: positive.default(30),
    /** Every this-many-th kick is a golden ball and counts double. */
    goldenEvery: z.number().int().positive().default(10),
    /** The play area's width in pitch units (the ball bounces off the sides). */
    width: positive.default(75),
    /** The ball's radius in pitch units: it bounces off a side wall when its edge meets it. */
    ballRadius: positive.default(5),
    /** A tap this close to the middle of the ball (in pitch units) touches it. Forgiving: a finger is bigger than the ball. */
    hitRadius: positive.default(12),
    /** A kick sends the ball sideways at up to this many pitch units a second, left or right, drawn from the seed. */
    drift: z.number().nonnegative().default(22),
  }),
  /** Keeper Reflex: a shot at the left, centre or right after a wait; dive that way in time. */
  keeper: z.object({
    shots: z.number().int().positive(),
    /** The wait before each shot, so it cannot be anticipated. */
    minDelayMs: positive,
    maxDelayMs: positive,
    /** Time to dive after the shot: the first shot's, falling evenly to the last one's. */
    firstWindowMs: positive,
    lastWindowMs: positive,
    /** A dive sooner than this after the shot is a guess, and counts as diving early. */
    minReactionMs: z.number().nonnegative(),
  }).default({ shots: 10, minDelayMs: 600, maxDelayMs: 1500, firstWindowMs: 900, lastWindowMs: 420, minReactionMs: 100 }),
  /** Dribble Dash: defenders come down the lanes; switch lane to go round them. One tackle ends it. */
  dribble: z.object({
    lanes: z.number().int().min(2),
    /** Defenders in a run: get past them all for the top score. */
    defenders: z.number().int().positive(),
    /** When the first defender comes on. */
    firstAtMs: z.number().nonnegative(),
    /** The gap between defenders, falling from the first to the last, plus up to `gapJitterMs` from the seed. */
    firstGapMs: positive,
    lastGapMs: positive,
    gapJitterMs: z.number().int().nonnegative(),
    /** How long a defender takes to run the length of the pitch, falling from the first to the last. */
    firstFallMs: positive,
    lastFallMs: positive,
    /** A defender can tackle between these points of its run (0 at the top, 1 past the player). */
    tackleFrom: z.number().min(0).max(1),
    tackleTo: z.number().min(0).max(1),
  }).default({ lanes: 3, defenders: 32, firstAtMs: 900, firstGapMs: 950, lastGapMs: 430, gapJitterMs: 120, firstFallMs: 1700, lastFallMs: 950, tackleFrom: 0.8, tackleTo: 0.96 }),
  /**
   * The warm-up before a league match is a play of one of the arcade games (picked for the match). The share of that
   * game's top score it reaches decides the attack bonus: at least `gold` is `match.warmupGold`, at least `green` is
   * `match.warmupGreen`, anything less `match.warmupMiss`.
   */
  warmup: z.object({
    gold: z.number().min(0).max(1).default(0.8),
    green: z.number().min(0).max(1).default(0.45),
  }).default({ gold: 0.8, green: 0.45 }),
})

export const DEFAULT_MINIGAMES: z.infer<typeof minigamesSchema> = {
  minTapGapMs: 120,
  clockSlack: 0.85,
  kick: { rounds: 5, minSpeed: 0.9, maxSpeed: 1.7, perfect: 0.04, good: 0.1, ok: 0.2, fastFactor: 1.4, narrowZone: 0.6, drift: 0.14 },
  pens: { rounds: 5, aimMinSpeed: 0.9, aimMaxSpeed: 1.6, keeperMinSpeed: 0.35, keeperMaxSpeed: 0.8, post: 0.1, corner: 0.28, reach: 0.12 },
  keepy: { gravity: 110, ramp: 0.18, minPeak: 36, maxPeak: 56, reach: 26, stumbleSteps: 30, maxKicks: 30, maxSeconds: 30, goldenEvery: 10, width: 75, ballRadius: 5, hitRadius: 12, drift: 22 },
  keeper: { shots: 10, minDelayMs: 600, maxDelayMs: 1500, firstWindowMs: 900, lastWindowMs: 420, minReactionMs: 100 },
  dribble: { lanes: 3, defenders: 32, firstAtMs: 900, firstGapMs: 950, lastGapMs: 430, gapJitterMs: 120, firstFallMs: 1700, lastFallMs: 950, tackleFrom: 0.8, tackleTo: 0.96 },
  warmup: { gold: 0.8, green: 0.45 },
}
