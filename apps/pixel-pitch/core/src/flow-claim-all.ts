import type { ClubState } from './club-state'
import type { GameConfig } from './config'
import type { Player } from './catalogue'
import type { FlowContext, FlowResult, LedgerEntry } from './flow'
import { dayIndex, pendingStadiumCoins, pendingTrayTokens } from './advance'
import { albumSets, isSetComplete } from './album'
import { GameRuleError } from './errors'
import { collectTray } from './flow-arcade'
import { claimAlbumSet, claimCalendar, claimFreePack, nextCalendarDay } from './flow-rewards'
import { collectStadium } from './flow-stadium'
import { tierReached } from './progress'

/** What a claim-all paid, for the pop-up: how many things it took, and what the wallet gained. */
export interface ClaimAllResult {
  items: number
  coins: number
  gems: number
  tokens: number
  /** Packs put on the shelf. */
  packs: number
  /** Star packs added to the pack store. */
  starPacks: number
}

/**
 * What is waiting to be claimed right now, for the hub and the badges. `claimAll` takes the idle rewards; finished
 * goals and League Pass tiers are claimed on their own screens.
 */
export interface Waiting {
  /** Coins piled up in the stadium. */
  stadiumCoins: number
  /** Tokens in the arcade tray. */
  trayTokens: number
  /** The calendar day that can be claimed today (1 to 7), or null if today's is taken. */
  calendarDay: number | null
  freePack: boolean
  /** Finished goals not yet claimed. */
  goals: number
  /** Pass tiers reached whose rewards are not yet claimed, on both tracks. */
  passTiers: number
  /** Finished album sets not yet claimed. */
  albumSets: number
}

export function waitingToClaim(input: { state: ClubState, catalogue: readonly Player[], config: GameConfig, now: number }): Waiting {
  const { state, catalogue, config, now } = input
  const reached = tierReached(state, config)
  let passTiers = 0
  for (let tier = 1; tier <= reached; tier++) {
    if (config.pass.free[tier - 1] && !state.pass.claimedFree.includes(tier))
      passTiers++
    if (state.idle.hasPass && config.pass.premium[tier - 1] && !state.pass.claimedPremium.includes(tier))
      passTiers++
  }
  const collected = new Set(state.album.collected)
  return {
    stadiumCoins: pendingStadiumCoins(state.idle, config, now),
    trayTokens: pendingTrayTokens(state.idle, config, now),
    calendarDay: nextCalendarDay(state.calendar, dayIndex(now, config)),
    freePack: !state.daily.freePackClaimed,
    goals: state.daily.goals.filter(goal => goal.progress >= goal.target && !goal.claimed).length,
    passTiers,
    albumSets: albumSets(catalogue, config).filter(set => !state.album.claimed.includes(set.id) && isSetComplete(set, collected)).length,
  }
}

/**
 * Takes the idle rewards that are waiting, in one go: the stadium's coins, the arcade tray, today's calendar day and
 * free pack, and every finished album set. It is exactly those claims one after another, done in one transaction, so
 * a phone with several things waiting makes one call. Refuses when there is nothing to take.
 *
 * Finished goals and League Pass tiers are not taken here: the player claims them on the Goals and League Pass
 * screens, where they see what each one was for.
 */
export function claimAll(ctx: FlowContext): FlowResult<ClaimAllResult> {
  const { config, now } = ctx
  let current = ctx
  let items = 0
  const ledger: LedgerEntry[] = []
  const take = (result: FlowResult<unknown>) => {
    current = { ...current, state: result.state }
    ledger.push(...(result.ledger ?? []))
    items++
  }

  const today = dayIndex(now, config)
  if (pendingStadiumCoins(current.state.idle, config, now) >= 1)
    take(collectStadium(current))
  if (pendingTrayTokens(current.state.idle, config, now) >= 1)
    take(collectTray(current))
  if (nextCalendarDay(current.state.calendar, today) !== null)
    take(claimCalendar(current))
  if (!current.state.daily.freePackClaimed)
    take(claimFreePack(current))
  const collected = new Set(current.state.album.collected)
  for (const set of albumSets(ctx.catalogue, config)) {
    if (!current.state.album.claimed.includes(set.id) && isSetComplete(set, collected))
      take(claimAlbumSet(current, set.id))
  }

  if (items === 0)
    throw new GameRuleError('nothing', 'There is nothing to claim right now.')

  const before = ctx.state
  const after = current.state
  return {
    state: after,
    ledger,
    extra: {
      items,
      coins: after.coins - before.coins,
      gems: after.idle.gems - before.idle.gems,
      tokens: after.tokens - before.tokens,
      packs: after.idle.shelfPacks - before.idle.shelfPacks,
      starPacks: after.starPacks - before.starPacks,
    },
  }
}
