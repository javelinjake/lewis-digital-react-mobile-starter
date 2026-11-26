import { z } from 'zod'

// The arcade games' and the warm-up kick's numbers, kept apart from the rest of the config because there are many.

const positive = z.number().positive()

/** Tuning of the arcade games and the warm-up kick. PLACEHOLDERS: balance in the first playtest. */
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
  /**
   * Penalty Shootout: five penalties. A ball wanders about the goal (and over the bar and wide of the posts) and the
   * keeper shuffles along the line; the shot goes where the ball is at the tap. In goal units: `x` from the left post,
   * `y` up from the ground. Every field has a default, so a config saved before these existed still loads.
   */
  pens: z.object({
    rounds: z.number().int().positive().default(5),
    /** The goal, post to post and ground to bar. */
    goalWidth: positive.default(100),
    goalHeight: positive.default(40),
    /** How far the ball wanders wide of each post, and above the bar. */
    wide: z.number().nonnegative().default(18),
    over: z.number().nonnegative().default(16),
    /** The ball's radius, drawn; it never wanders lower than this. */
    ballRadius: positive.default(4),
    /** The ball's loop: this many points, a leg between two taking between these (in the first round). */
    aimPoints: z.number().int().min(3).default(12),
    aimLegMinMs: positive.default(480),
    aimLegMaxMs: positive.default(900),
    /** Each point is at least this far from the one before, so the ball keeps travelling. */
    aimMinJump: z.number().nonnegative().default(30),
    /** The keeper's middle stays between these, so a corner is never always covered. */
    keeperMin: z.number().default(26),
    keeperMax: z.number().default(74),
    /** The keeper's loop along the line: this many stops, a move between two taking between these. */
    keeperPoints: z.number().int().min(2).default(8),
    keeperLegMinMs: positive.default(450),
    keeperLegMaxMs: positive.default(1300),
    /** The last round's legs are this fraction of the first's (the rounds between fall evenly): it gets quicker. */
    lastPace: z.number().min(0.3).max(1).default(0.75),
    /** The keeper saves a ball inside this ellipse: `reachX` either side of them, `reachY` above and below `reachMid`. */
    reachX: positive.default(20),
    reachY: positive.default(28),
    reachMid: z.number().nonnegative().default(14),
    /** The four corners of the goal, worth 2: this wide from a post and this deep from the bar or the ground. */
    cornerWidth: positive.default(22),
    cornerHeight: positive.default(14),
  }).default({ rounds: 5, goalWidth: 100, goalHeight: 40, wide: 18, over: 16, ballRadius: 4, aimPoints: 12, aimLegMinMs: 480, aimLegMaxMs: 900, aimMinJump: 30, keeperMin: 26, keeperMax: 74, keeperPoints: 8, keeperLegMinMs: 450, keeperLegMaxMs: 1300, lastPace: 0.75, reachX: 20, reachY: 28, reachMid: 14, cornerWidth: 22, cornerHeight: 14 }),
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
  /**
   * Keeper Reflex: a shot flies from the penalty spot at a point in the goal after a wait; tap the ball before it
   * crosses the line. In goal units, as the Penalty Shootout's: `x` from the left post, `y` up from the ground, and
   * the spot below the goal line (negative `y`), where it is drawn. Every field has a default.
   */
  keeper: z.object({
    shots: z.number().int().positive().default(10),
    /** The wait before each shot, so it cannot be anticipated. */
    minDelayMs: positive.default(600),
    maxDelayMs: positive.default(1500),
    /** The ball's flight, strike to line: the first shot's, falling evenly to the last one's. */
    firstWindowMs: positive.default(1000),
    lastWindowMs: positive.default(520),
    /** A tap sooner than this after the strike is a guess, and counts as diving early. */
    minReactionMs: z.number().nonnegative().default(100),
    /** The goal, post to post and ground to bar. */
    width: positive.default(100),
    height: positive.default(40),
    /** Shots cross the line at least this far inside the frame. */
    margin: z.number().nonnegative().default(6),
    /** How far below the goal line the spot is drawn: where every shot starts. */
    spotDepth: positive.default(46),
    /** A shot bends up to this far either way in flight. */
    maxCurve: z.number().nonnegative().default(14),
    /** The ball's radius on the spot and at the line (it shrinks as it flies away). */
    spotRadius: positive.default(6),
    lineRadius: positive.default(3.5),
    /** A tap this close to the middle of the ball saves it. Forgiving: a finger is bigger than the ball. */
    hitRadius: positive.default(14),
  }).default({ shots: 10, minDelayMs: 600, maxDelayMs: 1500, firstWindowMs: 1000, lastWindowMs: 520, minReactionMs: 100, width: 100, height: 40, margin: 6, spotDepth: 46, maxCurve: 14, spotRadius: 6, lineRadius: 3.5, hitRadius: 14 }),
  /** Pass Master: watch the passing move, then repeat it. A pass longer every round. */
  pass: z.object({
    players: z.number().int().min(2),
    /** Passes in the first round. */
    start: z.number().int().positive(),
    rounds: z.number().int().positive(),
    /** How long each pass is shown, and the gap before the next. */
    showMs: positive,
    gapMs: z.number().nonnegative(),
  }).default({ players: 4, start: 3, rounds: 8, showMs: 480, gapMs: 160 }),
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
  /** Target Practice: a target shows somewhere in the goal for a moment; tap it before it goes. */
  targets: z.object({
    count: z.number().int().positive(),
    /** The goal's size in its own units (a target's position and a tap's are in these). */
    width: positive,
    height: positive,
    /** Targets keep at least this far from the edges, and at least `minJump` from the last one. */
    margin: z.number().nonnegative(),
    minJump: z.number().nonnegative(),
    /** The target drawn, and the forgiving circle a tap must land in. */
    radius: positive,
    hitRadius: positive,
    /** How long a target stays: the first one's, falling evenly to the last one's. */
    firstLifeMs: positive,
    lastLifeMs: positive,
  }).default({ count: 15, width: 100, height: 80, margin: 12, minJump: 30, radius: 8, hitRadius: 11, firstLifeMs: 1150, lastLifeMs: 560 }),
  /** Cone Shuffle: the ball goes under a cone, the cones swap places; pick the one with the ball. */
  cones: z.object({
    cones: z.number().int().min(2),
    rounds: z.number().int().positive(),
    /** Swaps in the first round, and how many more each round after. */
    firstSwaps: z.number().int().positive(),
    swapsPerRound: z.number().int().nonnegative(),
    /** How long a swap takes: the first round's, falling evenly to the last round's. */
    firstSwapMs: positive,
    lastSwapMs: positive,
    /** How long the ball is shown before the cones move. */
    revealMs: positive,
  }).default({ cones: 3, rounds: 5, firstSwaps: 3, swapsPerRound: 1, firstSwapMs: 520, lastSwapMs: 240, revealMs: 1100 }),
  warmup: z.object({
    minSpeed: positive,
    maxSpeed: positive,
    /** Widths of the gold and green zones, as a fraction of the bar. */
    goldWidth: positive,
    greenWidth: positive,
  }),
})

export const DEFAULT_MINIGAMES: z.infer<typeof minigamesSchema> = {
  minTapGapMs: 120,
  clockSlack: 0.85,
  kick: { rounds: 5, minSpeed: 0.9, maxSpeed: 1.7, perfect: 0.04, good: 0.1, ok: 0.2, fastFactor: 1.4, narrowZone: 0.6, drift: 0.14 },
  pens: { rounds: 5, goalWidth: 100, goalHeight: 40, wide: 18, over: 16, ballRadius: 4, aimPoints: 12, aimLegMinMs: 480, aimLegMaxMs: 900, aimMinJump: 30, keeperMin: 26, keeperMax: 74, keeperPoints: 8, keeperLegMinMs: 450, keeperLegMaxMs: 1300, lastPace: 0.75, reachX: 20, reachY: 28, reachMid: 14, cornerWidth: 22, cornerHeight: 14 },
  keepy: { gravity: 110, ramp: 0.18, minPeak: 36, maxPeak: 56, reach: 26, stumbleSteps: 30, maxKicks: 30, maxSeconds: 30, goldenEvery: 10, width: 75, ballRadius: 5, hitRadius: 12, drift: 22 },
  keeper: { shots: 10, minDelayMs: 600, maxDelayMs: 1500, firstWindowMs: 1000, lastWindowMs: 520, minReactionMs: 100, width: 100, height: 40, margin: 6, spotDepth: 46, maxCurve: 14, spotRadius: 6, lineRadius: 3.5, hitRadius: 14 },
  pass: { players: 4, start: 3, rounds: 8, showMs: 480, gapMs: 160 },
  dribble: { lanes: 3, defenders: 32, firstAtMs: 900, firstGapMs: 950, lastGapMs: 430, gapJitterMs: 120, firstFallMs: 1700, lastFallMs: 950, tackleFrom: 0.8, tackleTo: 0.96 },
  targets: { count: 15, width: 100, height: 80, margin: 12, minJump: 30, radius: 8, hitRadius: 11, firstLifeMs: 1150, lastLifeMs: 560 },
  cones: { cones: 3, rounds: 5, firstSwaps: 3, swapsPerRound: 1, firstSwapMs: 520, lastSwapMs: 240, revealMs: 1100 },
  warmup: { minSpeed: 1.1, maxSpeed: 1.9, goldWidth: 0.1, greenWidth: 0.3 },
}
