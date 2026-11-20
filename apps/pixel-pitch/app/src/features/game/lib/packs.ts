import type { GameConfig, PackSource, Rarity } from '@ld/pixel-pitch-core'
import { oddsForTier, RARITIES } from '@ld/pixel-pitch-core'

/** The pack picture for a league: bronze in League 5 up to the legend pack from League 1. */
export function packArt(tier: number, source: PackSource = 'shelf') {
  if (source === 'star')
    return 'packs/pack_holo.png'
  if (source === 'arcade')
    return 'packs/pack_silver.png'
  return `packs/pack_${['bronze', 'silver', 'gold', 'holo', 'legend'][Math.min(Math.max(tier, 1), 5) - 1]}.png`
}

export const RARITY_LABEL: Record<Rarity, string> = { grassroots: 'Grassroots', semipro: 'Semi-Pro', pro: 'Pro', star: 'Star', legend: 'Legend' }

/** The odds for each rarity in a league, as whole-looking percentages, for the "odds before every rip" rule. */
export function oddsRows(tier: number, config: GameConfig) {
  const odds = oddsForTier(tier, config)
  return RARITIES.map((rarity, index) => ({ rarity, label: RARITY_LABEL[rarity], percent: odds[index] }))
}

export function formatPercent(percent: number) {
  return `${Number.isInteger(percent) ? percent : percent.toFixed(percent < 1 ? 2 : 1).replace(/0+$/, '').replace(/\.$/, '')}%`
}
