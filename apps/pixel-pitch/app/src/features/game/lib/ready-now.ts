import type { GameConfig, GameResponse, Player } from '@ld/pixel-pitch-core'
import { energyAt, waitingToClaim } from '@ld/pixel-pitch-core'

export interface ReadyItem {
  id: 'stadium' | 'tray' | 'calendar' | 'freePack' | 'goals' | 'pass' | 'album' | 'packs' | 'arcade'
  /** A claim: Claim all takes it. Otherwise it is something to go and do. */
  claim: boolean
  label: string
  /** The screen that has it. */
  to: string
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * What is ready for the player right now, most useful first: the things Claim all will take, then the things worth
 * going to do (packs to open, arcade energy to spend). Empty means there is nothing to do but wait.
 */
export function readyItems(game: GameResponse, config: GameConfig, catalogue: readonly Player[]): ReadyItem[] {
  const { state } = game.club
  const waiting = waitingToClaim({ state, catalogue, config, now: game.now })
  const items: ReadyItem[] = []
  if (waiting.stadiumCoins >= 1)
    items.push({ id: 'stadium', claim: true, label: `${waiting.stadiumCoins.toLocaleString('en-GB')} ${waiting.stadiumCoins === 1 ? 'coin' : 'coins'} in the stadium`, to: '/club' })
  if (waiting.trayTokens >= 1)
    items.push({ id: 'tray', claim: true, label: `${plural(waiting.trayTokens, 'token', 'tokens')} in the arcade tray`, to: '/arcade' })
  if (waiting.calendarDay !== null)
    items.push({ id: 'calendar', claim: true, label: `Calendar reward, day ${waiting.calendarDay}`, to: '/goals' })
  if (waiting.freePack)
    items.push({ id: 'freePack', claim: true, label: config.daily.freePackCount === 1 ? 'Your free pack' : `Your ${config.daily.freePackCount} free packs`, to: '/packs' })
  if (waiting.goals > 0)
    items.push({ id: 'goals', claim: true, label: `${plural(waiting.goals, 'goal', 'goals')} finished`, to: '/goals' })
  if (waiting.passTiers > 0)
    items.push({ id: 'pass', claim: true, label: `${plural(waiting.passTiers, 'Pass reward', 'Pass rewards')}`, to: '/pass' })
  if (waiting.albumSets > 0)
    items.push({ id: 'album', claim: true, label: `${plural(waiting.albumSets, 'finished album set', 'finished album sets')}`, to: '/album' })

  const packs = state.idle.shelfPacks + state.starPacks + (state.pendingPack ? 1 : 0)
  if (packs > 0)
    items.push({ id: 'packs', claim: false, label: `${plural(packs, 'pack', 'packs')} to open`, to: '/packs' })
  const energy = energyAt(state, config, game.now)
  if (energy > 0)
    items.push({ id: 'arcade', claim: false, label: `Arcade: ${energy} energy to spend`, to: '/arcade' })
  return items
}

/** How many things Claim all would take. */
export const claimCount = (items: readonly ReadyItem[]) => items.filter(item => item.claim).length
