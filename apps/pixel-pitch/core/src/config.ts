import { z } from 'zod'

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
  },
  daily: { gems: 15, gemsWithPass: 35, dayStartOffsetMinutes: 0 },
})

/** Throws a readable error if a config from the admin is unusable (for example, upgrade costs for the wrong number of levels). */
export function parseConfig(raw: unknown): GameConfig {
  const config = gameConfigSchema.parse(raw)
  if (config.stadium.upgradeCost.length !== config.stadium.coinsPerHour.length - 1)
    throw new Error('stadium.upgradeCost needs one entry per level after the first.')
  return config
}
