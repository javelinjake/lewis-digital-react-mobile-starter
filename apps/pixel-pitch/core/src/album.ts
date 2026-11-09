import type { Player } from './catalogue'
import type { ClubState } from './club-state'
import type { GameConfig } from './config'
import type { Position } from './positions'
import { NATIONS } from './catalogue'
import { POSITIONS } from './positions'

export interface AlbumSet {
  id: string
  name: string
  nation: number
  position: Position
  playerIds: string[]
}

const POSITION_NAMES: Record<Position, string> = { GK: 'Keepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' }
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const cache = new WeakMap<readonly Player[], Map<number, AlbumSet[]>>()

/**
 * The album's sets. Each nation's players of each position, best first, are dealt into sets of `setSize` like cards,
 * so every set mixes top and bottom players (the best set holds the group's best player, the next set the second
 * best, and so on). The few weakest players of a group that do not fill a set are not in the album.
 */
export function albumSets(catalogue: readonly Player[], config: Pick<GameConfig, 'album'>): AlbumSet[] {
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
  for (const [nation, nationName] of NATIONS.entries()) {
    for (const position of POSITIONS) {
      const group = catalogue
        .filter(player => player.nation === nation && player.position === position)
        .sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id))
      const count = Math.floor(group.length / size)
      for (let index = 0; index < count; index++) {
        sets.push({
          id: `${nationName.toLowerCase()}-${position.toLowerCase()}-${index + 1}`,
          name: `${nationName} ${POSITION_NAMES[position]} ${ROMAN[index] ?? index + 1}`,
          nation,
          position,
          playerIds: Array.from({ length: size }, (_, member) => group[index + member * count].id),
        })
      }
    }
  }
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
