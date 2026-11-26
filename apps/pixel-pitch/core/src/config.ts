import { z } from 'zod'
import { DEFAULT_MINIGAMES, minigamesSchema } from './config-minigames'

const byRarity = <T extends z.ZodType>(value: T) => z.object({ grassroots: value, semipro: value, pro: value, star: value, legend: value })

/**
 * Every number the game runs on. The api serves the live copy from an admin-editable global, validated by this schema,
 * so pacing can be tuned without an app release. Defaults below are the MVP spec's numbers; the ones marked
 * PLACEHOLDER are not in the spec and need tuning in the first playtest.
 */
const positive = z.number().positive()
const count = z.number().int().nonnegative()
const formationId = z.enum(['2-2', '1-2-1', '2-1-1', '3-1', '1-1-2'])

/** Something a goal, the calendar, the pass or an album set can pay out. `packs` go on the shelf, `starPacks` are guaranteed a Star or better. */
export const rewardSchema = z.object({
  kind: z.enum(['coins', 'gems', 'tokens', 'packs', 'starPacks']),
  amount: z.number().int().positive(),
})
export type Reward = z.infer<typeof rewardSchema>

export const GOAL_KINDS = ['openPacks', 'winMatches', 'playCabinets', 'trainPlayers', 'signPlayers', 'collectStadium', 'playChances', 'playChallenge', 'earnMedals'] as const
export type GoalKind = (typeof GOAL_KINDS)[number]

const goalSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(GOAL_KINDS),
  /** How many times it has to happen in one day. */
  target: z.number().int().positive(),
  reward: rewardSchema,
  /** The text shown: {n} becomes the target. */
  label: z.string(),
})
export type GoalDef = z.infer<typeof goalSchema>

/** Bronze, silver and gold, each a share (0 to 1) of the game's top score, rising. */
const medalShares = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)])

type Shares = [number, number, number]
/** Bronze, silver and gold scores, rising. */
const medalScores = z.tuple([count, count, count])

const DEFAULT_CHALLENGE = {
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
const DEFAULT_MASTERY: { shares: Record<'kick' | 'keepy' | 'pens' | 'keeper' | 'dribble', Shares>, rewards: Record<'bronze' | 'silver' | 'gold', Reward> } = {
  shares: { kick: [0.4, 0.65, 0.85], keepy: [0.3, 0.55, 0.8], pens: [0.4, 0.6, 0.8], keeper: [0.5, 0.7, 0.9], dribble: [0.3, 0.55, 0.8] },
  rewards: { bronze: { kind: 'coins', amount: 500 }, silver: { kind: 'tokens', amount: 80 }, gold: { kind: 'gems', amount: 15 } },
}

export const gameConfigSchema = z.object({
  /** Bumped on every change. Stamped on results so a result can be traced to the rules that produced it. */
  version: z.number().int().positive(),

  shelf: z.object({
    intervalMinutes: positive,
    capacity: z.number().int().positive(),
    capacityWithPass: z.number().int().positive(),
    playersPerPack: z.number().int().positive(),
    /** Packs bought with coins: price and how many a day. */
    extraPackCoins: count,
    extraPacksPerDay: count,
    /** Refilling the shelf with gems is a paid random item, so it is off at launch. */
    gemRefillEnabled: z.boolean(),
    gemRefillPacks: count,
    gemRefillCost: count,
  }),

  stadium: z.object({
    /** Coins per hour at each level. Length is the number of levels. PLACEHOLDER curve. */
    coinsPerHour: z.array(positive).min(1),
    /** Cost to reach each level from the one before (first entry is the cost of level 2). PLACEHOLDER. */
    upgradeCost: z.array(count),
    capHours: positive,
    capHoursWithPass: positive,
  }),

  cabinets: z.object({
    /** Tokens per hour while idle, for the arcade's one tray. PLACEHOLDER. */
    tokensPerHour: positive,
    trayCapHours: positive,
    trayCapHoursWithPass: positive,
    /** The arcade's stamina: one bar for every game, one point back every `regenMinutes`. PLACEHOLDERS. */
    energy: z.object({
      max: z.number().int().positive(),
      maxWithPass: z.number().int().positive(),
      regenMinutes: positive,
    }).default({ max: 5, maxWithPass: 6, regenMinutes: 90 }),
    /** Extra tokens a play pays in the cabinet of the day, as a fraction (0.5 is +50%). */
    hotBonus: z.number().min(0).max(2).default(0.5),
    arcadePackTokens: count,
    /** Most tokens one play can pay, at a perfect score. PLACEHOLDER. */
    playMaxTokens: count,
    /** Gems for an extra play once the energy is used. It pays coins and Pass XP, never tokens (tokens buy random packs). */
    gemPlayCost: count,
    gemPlayCoins: count,
  }),

  /** Tuning of the arcade games and the warm-up. PLACEHOLDERS: balance in the first playtest. */
  minigames: minigamesSchema,

  league: z.object({
    matchIntervalHours: positive,
    teams: z.number().int().min(2),
    /**
     * Points to go up from each tier, League 5 first. Each promotion is harder than the last. Past the end of the list
     * (the Prestige tiers) each gate is `prestigeGateStep` more than the one before. Defaults keep an older config valid.
     */
    promotionPoints: z.array(z.number().int().positive()).min(1).default([50, 65, 80, 100, 125]),
    prestigeGateStep: count.default(20),
    /** Rivals in the Prestige tiers: this much stronger each tier than the one before, up to `rivalCap`. */
    prestigeRivalStep: z.number().nonnegative().default(2),
    rivalCap: positive.default(96),
    /** Points for each result (a loss pays none), and coins for every result, so a losing club still grows. */
    winPoints: count,
    drawPoints: count,
    lossPoints: count,
    lossCoins: count,
    /** PLACEHOLDER: the spec only fixes what a loss pays. */
    winCoins: count,
    drawCoins: count,
    /** PLACEHOLDER: rival strength. League 5 rivals average this rating; each league up adds `rivalStep`. */
    rivalBaseRating: positive,
    rivalStep: positive,
    /** PLACEHOLDER: the strongest and weakest rival sit this far either side of the average. */
    rivalSpread: count,
    /** Fixtures simulated per catch-up at most. A player gone for longer misses the oldest ones. */
    maxCatchUpMatches: z.number().int().positive(),
    /**
     * A quick start: minutes before each of the first league matches (the first number is from founding the club to
     * match 1, the next from match 1 to match 2, and so on). After these, matches are `matchIntervalHours` apart.
     * PLACEHOLDER. Empty keeps every gap at the full interval. Defaults keep an older saved config valid.
     */
    openingGapsMinutes: z.array(positive).default([]),
  }),

  /** Friendlies the player starts whenever they like: coins for the first few each day, no league points, no Pass XP. */
  friendly: z.object({
    winCoins: count,
    drawCoins: count,
    lossCoins: count,
    /** Friendlies a day that pay coins. */
    paidPerDay: count,
    /** Friendlies a day in all. PLACEHOLDER. */
    maxPerDay: count.default(5),
  }).default({ winCoins: 150, drawCoins: 100, lossCoins: 60, paidPerDay: 5, maxPerDay: 5 }),

  /**
   * Prestige: every tier past League 1 is another league with a higher gate and stronger rivals. Each one reached is
   * for good: a star on the crest, a line in the trophy cabinet, and a small permanent bonus. Nothing is ever reset.
   */
  prestige: z.object({
    /** More coins from league matches and the stadium for each Prestige tier reached (0.02 is +2%). PLACEHOLDER. */
    coinBonusPerTier: z.number().min(0).max(0.5),
  }).default({ coinBonusPerTier: 0.02 }),

  /**
   * Mastery: bronze, silver and gold in each arcade game in each league, as shares of the game's top score. The games
   * are quicker each league, so the same share is harder higher up. The first time each medal is earned it pays once.
   * PLACEHOLDERS.
   */
  mastery: z.object({
    shares: z.object({ kick: medalShares, keepy: medalShares, pens: medalShares, keeper: medalShares, dribble: medalShares }),
    rewards: z.object({ bronze: rewardSchema, silver: rewardSchema, gold: rewardSchema }),
  }).default(DEFAULT_MASTERY),

  /**
   * The daily challenge: every player gets the day's featured game in endless mode, with the same pattern, once a day.
   * PLACEHOLDERS, to tune in playtest.
   */
  challenge: z.object({
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
  }).default(DEFAULT_CHALLENGE),

  /**
   * Match moments: one penalty, free kick or save, played with an arcade game. A Big Chance is banked from a league
   * match the player missed that ended in a draw or a one-goal loss; a live moment is offered in a match the player
   * watches. Scoring one moves the result up. PLACEHOLDERS, to tune in playtest.
   */
  moments: z.object({
    /** Big Chances kept at once. When full, the newest replaces the oldest. */
    bank: z.number().int().min(1),
    /** A match that kicked off at most this long before the player looked in was watched: it gets a live moment. */
    liveWindowMinutes: positive,
    /** How long the live moment waits for the player before it counts as a miss (the app's countdown). */
    decideSeconds: positive,
    /** Kick Timer points a free kick needs to go in (3 is the very middle). */
    freeKickPoints: z.number().int().min(1).max(3),
  }).default({ bank: 5, liveWindowMinutes: 5, decideSeconds: 10, freeKickPoints: 2 }),

  match: z.object({
    /**
     * Expected goals = baseXg × 2^((ATT − their DEF) ÷ doublingGap), at most maxXg. Every `doublingGap` points of
     * attack over the other side's defence doubles the goals expected. With these defaults two Boxes of equal players
     * expect the spec's 1.35 goals each.
     */
    baseXg: positive,
    doublingGap: positive,
    maxXg: positive,
    /** Match length in minutes: two 20-minute halves, as in 5-a-side. Events and the replay clock run to this. */
    minutes: z.number().int().min(10),
    /** The written report keeps the big moments, not every event. Defaults keep an older saved config valid. */
    report: z.object({
      /** Goals, saves and misses shown (every goal always is; the rest fill what is left of this). */
      maxMoments: z.number().int().min(1).max(20),
      /** A quiet match is topped up to this many with saves and misses that change nothing on the scoreboard. */
      minChances: z.number().int().min(0).max(20),
      /** Colour moments with no effect on the score, at most this many a match. */
      incidents: z.number().int().min(0).max(5),
    }).default({ maxMoments: 6, minChances: 4, incidents: 2 }),
    /** The warm-up: how much of the team's ATT the next match gets, for a gold, a green or a missed warm-up (see `minigames.warmup`). */
    warmupGold: z.number().min(0).max(0.5),
    warmupGreen: z.number().min(0).max(0.5),
    warmupMiss: z.number().min(0).max(0.5),
  }),

  formations: z.object({
    /**
     * Tactical edges: `formation` playing against `over` adds `points` to its ATT and DEF and takes them off the other
     * side's. Counter-picks come from this table. PLACEHOLDER values, to tune in playtest.
     */
    edges: z.array(z.object({ formation: formationId, over: formationId, points: z.number().nonnegative() })),
  }),

  cards: z.object({
    /** How many players of each rarity `generateCatalogue` makes. Only for building a new set: the live set is fixed data. */
    catalogueCounts: byRarity(count),
    /**
     * Catalogue ids taken out of packs and the album. Cards already owned keep working. The defaults bring the launch
     * set of 200 to 180: 60 Grassroots, 50 Semi-Pro, 40 Pro, 22 Star, 8 Legend.
     */
    retired: z.array(z.string()).default([]),
    /** Rating range per rarity, both ends included. */
    ratingBands: byRarity(z.tuple([z.number().int(), z.number().int()])),
    /** Coins for selling a one-star card of this rarity. Higher stars are worth the cards merged into them. */
    sellValue: byRarity(count),
    /** PLACEHOLDER: how many +1 rating trainings a card of this rarity can have. */
    trainingCap: byRarity(count),
    /** PLACEHOLDER: coins for the first training; each later one costs this × (trainings already done + 1). */
    trainingCost: byRarity(count),
    mergeCopies: z.number().int().min(2),
    mergeBonus: count,
    maxStars: z.number().int().min(1),
    /** Cards kept besides the five in the lineup. */
    benchSize: z.number().int().positive(),
  }),

  packs: z.object({
    /** Percent chance of each rarity (grassroots to legend) per player, for league 5 down to league 1. Rows sum to 100. */
    oddsByLeague: z.array(z.array(z.number().nonnegative()).length(5)).min(1),
    /** A Star or better is guaranteed within this many players. */
    pityPlayers: z.number().int().positive(),
    /** Arcade packs let you choose a position: players of it are this many times more likely. */
    positionBoost: positive,
  }),

  onboarding: z.object({
    /** The starter pack: one player for each of these positions, so the first lineup can be filled. */
    starterPositions: z.array(z.enum(['GK', 'DEF', 'MID', 'FWD'])).min(1),
    /** How many of them are Pro (the spec guarantees one). The rest are Grassroots or Semi-Pro. */
    starterPros: count,
  }),

  daily: z.object({
    gems: count,
    gemsWithPass: count,
    /** Minutes after UTC midnight that a new day starts. 240 is 04:00 UTC. */
    dayStartOffsetMinutes: z.number().int().min(0).max(1439),
    /** How many goals a day, drawn from `goals` (no two of one kind). */
    goalsPerDay: z.number().int().positive(),
    goals: z.array(goalSchema).min(1),
    /** Packs the Daily Free Pack puts on the shelf. */
    freePackCount: z.number().int().positive(),
  }),

  /** The 7-day login calendar. Claim a day, every day, for the next reward; missing a day starts again. Ends in a Star pack. */
  calendar: z.object({
    rewards: z.array(rewardSchema).length(7),
  }),

  pass: z.object({
    seasonDays: z.number().int().positive(),
    xpPerTier: positive,
    /** Pass XP from each thing. A win pays `match` + `win`. */
    xp: z.object({ match: count, win: count, pack: count, cabinet: count, goal: count, challenge: count.default(10), medal: count.default(5) }),
    /** One entry per tier: the free reward (or null) and the premium reward. 30 tiers. */
    free: z.array(rewardSchema.nullable()),
    premium: z.array(rewardSchema),
  }),

  album: z.object({
    /** Players in a set. Sets are every nation and position's players, best first, in groups of this many. */
    setSize: z.number().int().min(2),
    /** Team power for each finished set, as a fraction (0.01 is +1%). */
    bonusPerSet: z.number().nonnegative(),
    reward: rewardSchema,
  }),
})

export type GameConfig = z.infer<typeof gameConfigSchema>

/**
 * 30 tiers. Both tracks pay at every tier. On the free track the even tiers pay more (coins, tokens or a pack) and the
 * odd tiers a little (coins or tokens), ending in a Star pack; the premium track adds gems, more packs and Star packs at
 * 15 and 30. PLACEHOLDER values.
 */
function passTiers() {
  const tiers = 30
  const free = Array.from({ length: tiers }, (_, index) => {
    const tier = index + 1
    if (tier === tiers)
      return { kind: 'starPacks', amount: 1 }
    if (tier % 2 === 1)
      return tier % 4 === 1 ? { kind: 'coins', amount: 150 + tier * 10 } : { kind: 'tokens', amount: 25 }
    const cycle = (tier / 2) % 3
    return cycle === 1 ? { kind: 'coins', amount: 400 + tier * 20 } : cycle === 2 ? { kind: 'tokens', amount: 60 } : { kind: 'packs', amount: 1 }
  })
  const premium = Array.from({ length: tiers }, (_, index) => {
    const tier = index + 1
    if (tier === 15 || tier === tiers)
      return { kind: 'starPacks', amount: 1 }
    const cycle = tier % 3
    return cycle === 1 ? { kind: 'packs', amount: 1 } : cycle === 2 ? { kind: 'gems', amount: 30 } : { kind: 'coins', amount: 800 + tier * 20 }
  })
  return { free, premium }
}

export const DEFAULT_CONFIG: GameConfig = gameConfigSchema.parse({
  version: 6,
  shelf: {
    intervalMinutes: 240,
    capacity: 3,
    capacityWithPass: 5,
    playersPerPack: 3,
    extraPackCoins: 2000,
    extraPacksPerDay: 1,
    gemRefillEnabled: false,
    gemRefillPacks: 3,
    gemRefillCost: 60,
  },
  stadium: {
    coinsPerHour: [60, 90, 130, 180, 240, 310, 390, 480, 580, 700],
    upgradeCost: [1500, 3500, 7000, 12_000, 20_000, 32_000, 50_000, 78_000, 120_000],
    capHours: 8,
    capHoursWithPass: 12,
  },
  cabinets: {
    tokensPerHour: 24,
    trayCapHours: 8,
    trayCapHoursWithPass: 12,
    energy: { max: 5, maxWithPass: 6, regenMinutes: 90 },
    hotBonus: 0.5,
    arcadePackTokens: 450,
    playMaxTokens: 60,
    gemPlayCost: 20,
    gemPlayCoins: 300,
  },
  league: {
    matchIntervalHours: 3,
    teams: 6,
    // Set with the pacing simulation: an idle-only player reaches League 1 in about 26 days, an engaged and skilled
    // one in about 17.
    promotionPoints: [50, 65, 80, 100, 125],
    prestigeGateStep: 20,
    prestigeRivalStep: 2,
    rivalCap: 96,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    lossCoins: 250,
    winCoins: 600,
    drawCoins: 400,
    rivalBaseRating: 52,
    rivalStep: 9,
    rivalSpread: 4,
    maxCatchUpMatches: 56,
    openingGapsMinutes: [5, 8, 10, 12, 15],
  },
  friendly: { winCoins: 150, drawCoins: 100, lossCoins: 60, paidPerDay: 5, maxPerDay: 5 },
  moments: { bank: 5, liveWindowMinutes: 5, decideSeconds: 10, freeKickPoints: 2 },
  prestige: { coinBonusPerTier: 0.02 },
  mastery: DEFAULT_MASTERY,
  challenge: DEFAULT_CHALLENGE,
  match: { baseXg: 2.4, doublingGap: 20, maxXg: 8, minutes: 40, report: { maxMoments: 6, minChances: 4, incidents: 2 }, warmupGold: 0.1, warmupGreen: 0.05, warmupMiss: 0.02 },
  formations: {
    // A three-way cycle with the big edges, a second cycle with small ones, and the smallest to settle the rest.
    edges: [
      { formation: '3-1', over: '1-1-2', points: 5 },
      { formation: '1-2-1', over: '3-1', points: 5 },
      { formation: '1-1-2', over: '1-2-1', points: 5 },
      { formation: '1-2-1', over: '2-2', points: 2 },
      { formation: '2-1-1', over: '1-1-2', points: 2 },
      { formation: '2-2', over: '2-1-1', points: 2 },
      { formation: '2-2', over: '3-1', points: 1 },
      { formation: '2-1-1', over: '1-2-1', points: 1 },
      { formation: '1-1-2', over: '2-2', points: 1 },
      { formation: '3-1', over: '2-1-1', points: 1 },
    ],
  },
  cards: {
    catalogueCounts: { grassroots: 60, semipro: 60, pro: 45, star: 25, legend: 10 },
    ratingBands: { grassroots: [44, 52], semipro: [55, 63], pro: [65, 73], star: [76, 84], legend: [86, 94] },
    sellValue: { grassroots: 50, semipro: 150, pro: 600, star: 3000, legend: 20_000 },
    trainingCap: { grassroots: 3, semipro: 4, pro: 5, star: 6, legend: 8 },
    trainingCost: { grassroots: 100, semipro: 250, pro: 600, star: 1500, legend: 4000 },
    mergeCopies: 3,
    mergeBonus: 6,
    maxStars: 5,
    benchSize: 20,
    retired: ['p062', 'p064', 'p070', 'p078', 'p091', 'p094', 'p100', 'p105', 'p108', 'p115', 'p121', 'p145', 'p153', 'p154', 'p159', 'p168', 'p185', 'p190', 'p192', 'p198'],
  },
  packs: {
    // League 5 and League 1 are the spec's. The three between are straight-line steps: PLACEHOLDER.
    oddsByLeague: [
      [70, 24, 5, 0.9, 0.1],
      [58.75, 26.75, 10.75, 3.175, 0.575],
      [47.5, 29.5, 16.5, 5.45, 1.05],
      [36.25, 32.25, 22.25, 7.725, 1.525],
      [25, 35, 28, 10, 2],
    ],
    pityPlayers: 40,
    positionBoost: 2,
  },
  onboarding: { starterPositions: ['FWD', 'FWD', 'DEF', 'DEF', 'GK'], starterPros: 1 },
  minigames: DEFAULT_MINIGAMES,
  daily: {
    gems: 15,
    gemsWithPass: 35,
    dayStartOffsetMinutes: 0,
    goalsPerDay: 3,
    freePackCount: 1,
    goals: [
      { id: 'rip', kind: 'openPacks', target: 3, reward: { kind: 'coins', amount: 600 }, label: 'Open {n} packs' },
      { id: 'win', kind: 'winMatches', target: 1, reward: { kind: 'gems', amount: 10 }, label: 'Win {n} match' },
      { id: 'arcade', kind: 'playCabinets', target: 2, reward: { kind: 'tokens', amount: 60 }, label: 'Play {n} arcade games' },
      { id: 'train', kind: 'trainPlayers', target: 1, reward: { kind: 'coins', amount: 400 }, label: 'Train {n} player' },
      { id: 'sign', kind: 'signPlayers', target: 3, reward: { kind: 'coins', amount: 500 }, label: 'Sign {n} players' },
      { id: 'stadium', kind: 'collectStadium', target: 1, reward: { kind: 'coins', amount: 300 }, label: 'Collect the stadium coins' },
      { id: 'chance', kind: 'playChances', target: 1, reward: { kind: 'coins', amount: 400 }, label: 'Take {n} Big Chance or live moment' },
      { id: 'challenge', kind: 'playChallenge', target: 1, reward: { kind: 'tokens', amount: 60 }, label: 'Play the daily challenge' },
      { id: 'medal', kind: 'earnMedals', target: 1, reward: { kind: 'gems', amount: 10 }, label: 'Earn {n} arcade medal' },
    ],
  },
  calendar: {
    rewards: [
      { kind: 'coins', amount: 500 },
      { kind: 'gems', amount: 10 },
      { kind: 'packs', amount: 1 },
      { kind: 'coins', amount: 1500 },
      { kind: 'tokens', amount: 100 },
      { kind: 'gems', amount: 25 },
      // Day 7 is worth more than a normal day's packs.
      { kind: 'starPacks', amount: 3 },
    ],
  },
  pass: {
    seasonDays: 28,
    xpPerTier: 100,
    xp: { match: 2, win: 1, pack: 2, cabinet: 3, goal: 15, challenge: 10, medal: 5 },
    ...passTiers(),
  },
  album: { setSize: 6, bonusPerSet: 0.01, reward: { kind: 'packs', amount: 1 } },
})

/** Throws a readable error if a config from the admin is unusable (for example, upgrade costs for the wrong number of levels). */
export function parseConfig(raw: unknown): GameConfig {
  const config = gameConfigSchema.parse(raw)
  if (config.match.report.minChances > config.match.report.maxMoments)
    throw new Error('match.report.minChances is more than match.report.maxMoments.')
  if (config.stadium.upgradeCost.length !== config.stadium.coinsPerHour.length - 1)
    throw new Error('stadium.upgradeCost needs one entry per level after the first.')
  for (const [league, row] of config.packs.oddsByLeague.entries()) {
    const total = row.reduce((sum, value) => sum + value, 0)
    if (Math.abs(total - 100) > 0.01)
      throw new Error(`packs.oddsByLeague row ${league + 1} adds up to ${total}, not 100.`)
  }
  if (config.onboarding.starterPros > config.onboarding.starterPositions.length)
    throw new Error('onboarding.starterPros is more than the number of starter players.')
  for (const [rarity, [low, high]] of Object.entries(config.cards.ratingBands)) {
    if (low > high)
      throw new Error(`cards.ratingBands.${rarity} has its low end above its high end.`)
  }
  const tiers = config.pass.premium.length
  if (config.pass.free.length !== tiers)
    throw new Error('pass.free and pass.premium need one entry per tier.')
  if (new Set(config.daily.goals.map(goal => goal.id)).size !== config.daily.goals.length)
    throw new Error('daily.goals has two goals with the same id.')
  if (new Set(config.daily.goals.map(goal => goal.kind)).size < config.daily.goalsPerDay)
    throw new Error('daily.goals needs at least as many different kinds as goalsPerDay.')
  const { kick, keepy, warmup, keeper, dribble } = config.minigames
  if (kick.minSpeed > kick.maxSpeed || warmup.green > warmup.gold || keepy.minPeak > keepy.maxPeak || keeper.minDelayMs > keeper.maxDelayMs || dribble.tackleFrom > dribble.tackleTo)
    throw new Error('A minigames range has its low end above its high end.')
  for (const [cabinet, shares] of Object.entries(config.mastery.shares)) {
    if (!(shares[0] <= shares[1] && shares[1] <= shares[2]))
      throw new Error(`mastery.shares.${cabinet} must rise from bronze to gold.`)
  }
  const pairs = new Set<string>()
  for (const edge of config.formations.edges) {
    if (edge.formation === edge.over)
      throw new Error(`formations.edges has ${edge.formation} with an edge over itself.`)
    const pair = [edge.formation, edge.over].sort().join(' v ')
    if (pairs.has(pair))
      throw new Error(`formations.edges lists ${pair} more than once. Give one side the edge.`)
    pairs.add(pair)
  }
  return config
}
