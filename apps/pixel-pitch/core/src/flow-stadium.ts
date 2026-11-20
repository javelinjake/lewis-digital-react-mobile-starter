import type { FlowContext, FlowResult, LedgerEntry } from './flow'
import { pendingStadiumCoins } from './advance'
import { GameRuleError } from './errors'
import { recordProgress } from './progress'

/** The stadium's picture: stage 1 for levels 1-3, stage 2 for 4-7, stage 3 for 8-10. */
export function stadiumStage(level: number) {
  return level >= 8 ? 3 : level >= 4 ? 2 : 1
}

/** Takes the coins that have piled up in the stadium. The pile fills at the level's rate, up to 8 hours' worth (12 with the Pass). */
export function collectStadium(ctx: FlowContext): FlowResult<{ coins: number }> {
  const { state, config, now } = ctx
  const coins = pendingStadiumCoins(state.idle, config, now)
  if (coins < 1)
    throw new GameRuleError('empty', 'There is nothing to collect yet.')
  const next = { ...state, coins: state.coins + coins, idle: { ...state.idle, stadiumCollectedAt: now } }
  return { state: recordProgress(next, 'collectStadium'), ledger: [{ currency: 'coins', amount: coins, reason: 'stadium' }], extra: { coins } }
}

/** Upgrades the stadium one level. The pile is collected first, so the new rate starts from a clean slate. */
export function upgradeStadium(ctx: FlowContext): FlowResult<{ level: number, cost: number }> {
  const { state, config, now } = ctx
  const level = state.idle.stadiumLevel
  if (level >= config.stadium.coinsPerHour.length)
    throw new GameRuleError('max-level', 'Your stadium is as big as it gets.')
  const cost = config.stadium.upgradeCost[level - 1]
  const pile = pendingStadiumCoins(state.idle, config, now)
  if (state.coins + pile < cost)
    throw new GameRuleError('coins', `The next level costs ${cost.toLocaleString('en-GB')} coins.`)

  const ledger: LedgerEntry[] = []
  if (pile > 0)
    ledger.push({ currency: 'coins', amount: pile, reason: 'stadium' })
  ledger.push({ currency: 'coins', amount: -cost, reason: 'stadium-upgrade', ref: String(level + 1) })
  return {
    state: { ...state, coins: state.coins + pile - cost, idle: { ...state.idle, stadiumLevel: level + 1, stadiumCollectedAt: now } },
    ledger,
    extra: { level: level + 1, cost },
  }
}
