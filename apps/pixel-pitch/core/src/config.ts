import { z } from 'zod'

const byRarity = <T extends z.ZodType>(value: T) => z.object({ grassroots: value, semipro: value, pro: value, star: value, legend: value })

/**
 * Every number the game runs on. The api serves the live copy from an admin-editable global, validated by this schema,
 * so pacing can be tuned without an app release. Defaults below are the MVP spec's numbers; the ones marked
 * PLACEHOLDER are not in the spec and need tuning in the first playtest.
 */
const positive = z.number().positive()
const count = z.number().int().nonnegative()
const formationId = z.enum(['2-2', '1-2-1', '2-1-1', '3-1', '1-1-2'])

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
    /** Tokens per hour while idle, per cabinet. PLACEHOLDER. */
    tokensPerHour: positive,
    trayCapHours: positive,
    trayCapHoursWithPass: positive,
    freePlaysPerDay: count,
    freePlaysPerDayWithPass: count,
    arcadePackTokens: count,
  }),

  league: z.object({
    matchIntervalHours: positive,
    teams: z.number().int().min(2),
    pointsToPromote: z.number().int().positive(),
    /** Points and coins for every result, so a loss still pays. */
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
  }),

  match: z.object({
    /**
     * Expected goals = baseXg × 2^((ATT − their DEF) ÷ doublingGap), at most maxXg. Every `doublingGap` points of
     * attack over the other side's defence doubles the goals expected. With these defaults two Boxes of equal players
     * expect the spec's 1.35 goals each.
     */
    baseXg: positive,
    doublingGap: positive,
    maxXg: positive,
    /** Pre-match kick: how much of the team's ATT the next match gets. */
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
    /** How many of the 200 catalogue players are of each rarity. */
    catalogueCounts: byRarity(count),
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
  }),
})

export type GameConfig = z.infer<typeof gameConfigSchema>

export const DEFAULT_CONFIG: GameConfig = gameConfigSchema.parse({
  version: 2,
  shelf: {
    intervalMinutes: 45,
    capacity: 10,
    capacityWithPass: 16,
    playersPerPack: 3,
    extraPackCoins: 2000,
    extraPacksPerDay: 3,
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
    tokensPerHour: 12,
    trayCapHours: 8,
    trayCapHoursWithPass: 12,
    freePlaysPerDay: 3,
    freePlaysPerDayWithPass: 4,
    arcadePackTokens: 300,
  },
  league: {
    matchIntervalHours: 3,
    teams: 6,
    pointsToPromote: 30,
    winPoints: 3,
    drawPoints: 2,
    lossPoints: 1,
    lossCoins: 250,
    winCoins: 600,
    drawCoins: 400,
    rivalBaseRating: 52,
    rivalStep: 7,
    rivalSpread: 4,
    maxCatchUpMatches: 56,
  },
  match: { baseXg: 2.4, doublingGap: 20, maxXg: 8, warmupGold: 0.1, warmupGreen: 0.05, warmupMiss: 0.02 },
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
  daily: { gems: 15, gemsWithPass: 35, dayStartOffsetMinutes: 0 },
})

/** Throws a readable error if a config from the admin is unusable (for example, upgrade costs for the wrong number of levels). */
export function parseConfig(raw: unknown): GameConfig {
  const config = gameConfigSchema.parse(raw)
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
