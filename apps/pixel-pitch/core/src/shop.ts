import type { ClubState } from './club-state'
import type { GameConfig } from './config'
import type { FlowContext, FlowResult } from './flow'
import { GameRuleError } from './errors'

// The shop sells looks and convenience, never power: gems buy cosmetics. Nothing that wins matches, no daily
// challenge attempts and no place on a leaderboard is ever for sale. Pack odds are published on the Packs screen.

/** The kits every club can wear: primary, secondary and a name. Premium kits are in `config.shop.kits`. */
export const FREE_KITS: ReadonlyArray<readonly [primary: string, secondary: string, name: string]> = [
  ['#e2483d', '#f4f4f4', 'Red and white'],
  ['#3f7fd6', '#f4f4f4', 'Blue and white'],
  ['#ffd23f', '#1b1f3b', 'Yellow and navy'],
  ['#3fa34d', '#f4f4f4', 'Green and white'],
  ['#10122a', '#ffd23f', 'Black and yellow'],
  ['#ff4f79', '#1b1f3b', 'Pink and navy'],
  ['#ff9f43', '#10122a', 'Orange and black'],
  ['#5ec8ff', '#1b1f3b', 'Sky and navy'],
]

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Whether a kit is one of the free ones. */
export function isFreeKit(primary: string, secondary: string) {
  return FREE_KITS.some(([one, two]) => same(one, primary) && same(two, secondary))
}

/** The premium kit with these colours, if there is one. */
export function premiumKit(primary: string, secondary: string, config: Pick<GameConfig, 'shop'>) {
  return config.shop.kits.find(kit => same(kit.primary, primary) && same(kit.secondary, secondary))
}

/** Whether the club may wear a kit: a free one, or a premium one it has bought. */
export function mayWearKit(state: Pick<ClubState, 'cosmetics'>, primary: string, secondary: string, config: Pick<GameConfig, 'shop'>) {
  if (isFreeKit(primary, secondary))
    return true
  const kit = premiumKit(primary, secondary, config)
  return kit !== undefined && state.cosmetics.includes(kit.id)
}

/** Buys a premium kit with gems. It is the club's for good; wearing it is a separate choice. */
export function buyKit(ctx: FlowContext, kitId: string): FlowResult<{ kitId: string, gems: number }> {
  const { state, config } = ctx
  const kit = config.shop.kits.find(entry => entry.id === kitId)
  if (!kit)
    throw new GameRuleError('no-item', 'That kit is not in the shop.')
  if (state.cosmetics.includes(kit.id))
    throw new GameRuleError('owned', 'You already have that kit.')
  if (state.idle.gems < kit.gems)
    throw new GameRuleError('gems', `That kit costs ${kit.gems} gems.`)
  return {
    state: { ...state, cosmetics: [...state.cosmetics, kit.id], idle: { ...state.idle, gems: state.idle.gems - kit.gems } },
    ledger: [{ currency: 'gems', amount: -kit.gems, reason: 'shop', ref: kit.id }],
    extra: { kitId: kit.id, gems: kit.gems },
  }
}
