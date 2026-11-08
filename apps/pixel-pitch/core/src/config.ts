import { z } from 'zod'

const byRarity = <T extends z.ZodType>(value: T) => z.object({ grassroots: value, semipro: value, pro: value, star: value, legend: value })

/**
 * Every number the game runs on. The api serves the live copy from an admin-editable global, validated by this schema,
 * so pacing can be tuned without an app release. Defaults below are the MVP spec's numbers; the ones marked
 * PLACEHOLDER are not in the spec and need tuning in the first playtest.
 */
const positive = z.number().positive()
const count = z.number().int().nonnegative()

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
    /** Expected goals = scale × (attack ÷ their defence)². */
    xgScale: positive,
    /** Pre-match kick: how much of the team's ATT the next match gets. */
    warmupGold: z.number().min(0).max(0.5),
    warmupGreen: z.number().min(0).max(0.5),
    warmupMiss: z.number().min(0).max(0.5),
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

  daily: z.object({
    gems: count,
    gemsWithPass: count,
    /** Minutes after UTC midnight that a new day starts. 240 is 04:00 UTC. */
    dayStartOffsetMinutes: z.number().int().min(0).max(1439),
  }),
})

export type GameConfig = z.infer<typeof gameConfigSchema>

export const DEFAULT_CONFIG: GameConfig = gameConfigSchema.parse({
  version: 1,
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
  match: { xgScale: 1.35, warmupGold: 0.1, warmupGreen: 0.05, warmupMiss: 0.02 },
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
  for (const [rarity, [low, high]] of Object.entries(config.cards.ratingBands)) {
    if (low > high)
      throw new Error(`cards.ratingBands.${rarity} has its low end above its high end.`)
  }
  return config
}
