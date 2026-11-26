import type { Player } from './catalogue'
import type { ClubState } from './club-state'
import type { GameConfig } from './config'
import { NATIONS, packPool } from './catalogue'

export interface AlbumSet {
  id: string
  name: string
  /** The nation the set is from, or -1 for the Internationals: the few left over from every nation. */
  nation: number
  playerIds: string[]
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

const cache = new WeakMap<readonly Player[], Map<number, AlbumSet[]>>()
// Keyed by the pack pool, which is a new array whenever the retired list changes.

/** Deals players, best first, into `count` sets of `size` like cards, so every set mixes top and bottom players. */
function deal(players: readonly Player[], count: number, size: number): string[][] {
  return Array.from({ length: count }, (_, index) => Array.from({ length: size }, (_, member) => players[index + member * count].id))
}

const byRating = (a: Player, b: Player) => b.rating - a.rating || a.id.localeCompare(b.id)

/**
 * The album's sets. Each nation's players, best first, are dealt into sets of `setSize`, so every set mixes top and
 * bottom players and positions. The few weakest of each nation that do not fill a set go together into the
 * Internationals sets. With the launch pool (180 in packs) that is 30 sets of six with every player in one.
 */
export function albumSets(all: readonly Player[], config: Pick<GameConfig, 'album' | 'cards'>): AlbumSet[] {
  // Retired players are not in the album; the sets are dealt from the players in packs.
  const catalogue = packPool(all, config)
  const size = config.album.setSize
  let bySize = cache.get(catalogue)
  if (!bySize) {
    bySize = new Map()
    cache.set(catalogue, bySize)
  }
  const cached = bySize.get(size)
  if (cached)
    return cached

  const sets: AlbumSet[] = []
  const leftOver: Player[] = []
  for (const [nation, nationName] of NATIONS.entries()) {
    const group = catalogue.filter(player => player.nation === nation).sort(byRating)
    const count = Math.floor(group.length / size)
    leftOver.push(...group.slice(count * size))
    deal(group.slice(0, count * size), count, size).forEach((playerIds, index) => sets.push({
      id: `${nationName.toLowerCase()}-${index + 1}`,
      name: `${nationName} ${ROMAN[index] ?? index + 1}`,
      nation,
      playerIds,
    }))
  }
  const internationals = leftOver.sort(byRating)
  const count = Math.floor(internationals.length / size)
  deal(internationals.slice(0, count * size), count, size).forEach((playerIds, index) => sets.push({
    id: `internationals-${index + 1}`,
    name: `Internationals ${ROMAN[index] ?? index + 1}`,
    nation: -1,
    playerIds,
  }))
  bySize.set(size, sets)
  return sets
}

export function isSetComplete(set: AlbumSet, collected: ReadonlySet<string> | readonly string[]) {
  const owned = collected instanceof Set ? collected : new Set(collected)
  return set.playerIds.every(id => owned.has(id))
}

/** Records players as collected (every player you have pulled counts, even if you sold them) and recounts finished sets. */
export function recordCollected(state: ClubState, playerIds: readonly string[], sets: readonly AlbumSet[]): ClubState {
  const collected = new Set(state.album.collected)
  for (const id of playerIds)
    collected.add(id)
  if (collected.size === state.album.collected.length)
    return state
  return { ...state, album: { ...state.album, collected: [...collected], completed: sets.filter(set => isSetComplete(set, collected)).length } }
}

/** Team power from finished sets: +1% each by default. */
export function albumPower(state: Pick<ClubState, 'album'>, config: Pick<GameConfig, 'album'>): number {
  return state.album.completed * config.album.bonusPerSet
}
