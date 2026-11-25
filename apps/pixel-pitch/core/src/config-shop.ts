import { z } from 'zod'
import { rewardSchema } from './config-rewards'

const count = z.number().int().nonnegative()
const positive = z.number().positive()

/**
 * What money buys. Every product pays things the player can see before paying; none is a random roll. `id` is the
 * product id in App Store Connect, Google Play and RevenueCat. The store sets the real price; `price` is shown only
 * where the store's price is not available (the web, the playtest build).
 */
export const shopSchema = z.object({
  products: z.array(z.object({
    id: z.string().min(1),
    kind: z.enum(['pass', 'licence', 'starter', 'gems']),
    title: z.string(),
    price: z.string(),
    /** What it pays. The Pass and the Licence unlock their perks instead. */
    rewards: z.array(rewardSchema),
  })).min(1),
  /** The starter offer can be bought once, within this many hours of founding the club. */
  starterHours: positive,
  /** Gem prices of the things gems buy, besides an extra arcade play (`cabinets.gemPlayCost`). */
  gems: z.object({
    energyRefill: count,
    benchSlots: count,
    warmupRetry: count,
    identityChange: count,
  }),
  /** Extra bench room each purchase of bench slots adds, how many times it can be bought, and what the Licence adds. */
  benchSlotsEach: z.number().int().positive(),
  benchSlotsMaxBuys: count,
  licenceBenchSlots: count,
})

/** Premium kits: bought with gems (`gems`), or Pass rewards only (`gems` null). The eight starting kits are free. */
export const cosmeticsSchema = z.object({
  kits: z.array(z.object({ id: z.string().min(1), name: z.string(), primary: z.string(), secondary: z.string(), gems: count.nullable() })),
})

export const DEFAULT_SHOP: z.input<typeof shopSchema> = {
  products: [
    { id: 'pp_starter', kind: 'starter', title: 'Starter offer', price: '£1.99', rewards: [{ kind: 'signing', amount: 1 }, { kind: 'gems', amount: 300 }, { kind: 'coins', amount: 5000 }] },
    { id: 'pp_league_pass', kind: 'pass', title: 'League Pass', price: '£3.99', rewards: [] },
    { id: 'pp_chairman_licence', kind: 'licence', title: 'Chairman\'s Licence', price: '£2.99', rewards: [] },
    { id: 'pp_gems_80', kind: 'gems', title: 'Handful of gems', price: '£0.99', rewards: [{ kind: 'gems', amount: 80 }] },
    { id: 'pp_gems_500', kind: 'gems', title: 'Bag of gems', price: '£4.99', rewards: [{ kind: 'gems', amount: 500 }] },
    { id: 'pp_gems_1100', kind: 'gems', title: 'Crate of gems', price: '£9.99', rewards: [{ kind: 'gems', amount: 1100 }] },
    { id: 'pp_gems_2400', kind: 'gems', title: 'Vault of gems', price: '£19.99', rewards: [{ kind: 'gems', amount: 2400 }] },
  ],
  starterHours: 72,
  gems: { energyRefill: 50, benchSlots: 100, warmupRetry: 10, identityChange: 50 },
  benchSlotsEach: 5,
  benchSlotsMaxBuys: 3,
  licenceBenchSlots: 5,
}

export const DEFAULT_COSMETICS: z.input<typeof cosmeticsSchema> = {
  kits: [
    { id: 'season-gold', name: 'Season gold', primary: '#d4a017', secondary: '#10122a', gems: null },
    { id: 'season-night', name: 'Night shift', primary: '#2b2d6e', secondary: '#5ec8ff', gems: null },
    { id: 'claret', name: 'Claret and sky', primary: '#7a1f3d', secondary: '#8fd3ff', gems: 150 },
    { id: 'tangerine', name: 'Tangerine and black', primary: '#ff7a1a', secondary: '#141414', gems: 150 },
    { id: 'mint', name: 'Mint and white', primary: '#6fe3b4', secondary: '#f4f4f4', gems: 200 },
    { id: 'royal', name: 'Royal purple', primary: '#5a2d91', secondary: '#ffd23f', gems: 250 },
    { id: 'ice', name: 'Ice white', primary: '#eef6ff', secondary: '#3f7fd6', gems: 300 },
  ],
}
