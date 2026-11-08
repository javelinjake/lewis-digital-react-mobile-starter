import type { GameConfig } from './config'
import type { Position, Rarity } from './positions'
import { createRng, type Rng } from '@ld/utils/random/rng'
import { NATION_COUNT, POSITIONS, RARITIES } from './positions'

/** The four fictional nations, in the order their numbers are used everywhere (chemistry, flags, names). */
export const NATIONS = ['Northvale', 'Emberland', 'Greenmoor', 'Solaria'] as const
export const HAIR_STYLES = ['bald', 'afro', 'buzz', 'fringe', 'long', 'mohawk', 'short', 'topknot'] as const
export const HAIR_COLOURS = ['black', 'blonde', 'brown', 'dark', 'ginger', 'silver'] as const
export const SKIN_TONES = 5

/** Which layers draw the player: skin tone, hair style (0 is bald, no layer) and hair colour. Kit comes from the club. */
export interface SpriteParts {
  skin: number
  hairStyle: number
  hairColour: number
}

export interface Player {
  id: string
  name: string
  nation: number
  position: Position
  altPosition?: Position
  rarity: Rarity
  /** The base rating of a one-star card with no training. */
  rating: number
  sprite: SpriteParts
}

// Invented names only. Nothing here belongs to a real player.
const NAMES: ReadonlyArray<{ first: readonly string[], last: readonly string[] }> = [
  {
    first: ['Aldric', 'Bram', 'Corvin', 'Eskil', 'Frode', 'Halden', 'Ivar', 'Kasper', 'Leif', 'Nils'],
    last: ['Vennik', 'Halvane', 'Skarn', 'Dovrek', 'Ellmark', 'Fjeldan', 'Grimholt', 'Hesvik', 'Ironvale', 'Jarlsen'],
  },
  {
    first: ['Cael', 'Dunstan', 'Emrys', 'Fenn', 'Garrick', 'Idris', 'Kieran', 'Lorcan', 'Morgan', 'Rhys'],
    last: ['Ashgrove', 'Blackthorn', 'Cinderfield', 'Dunmere', 'Emberly', 'Firthwood', 'Glenmoss', 'Harrowick', 'Kilbrae', 'Lochran'],
  },
  {
    first: ['Alder', 'Bryn', 'Cedric', 'Dorian', 'Elwin', 'Finlay', 'Hollis', 'Jasper', 'Linus', 'Orrin'],
    last: ['Mossley', 'Fernwick', 'Thistledown', 'Heathcote', 'Bramwell', 'Wrenfield', 'Oakhurst', 'Peatley', 'Rushworth', 'Bracken'],
  },
  {
    first: ['Alonzo', 'Benito', 'Cosimo', 'Dante', 'Emilio', 'Fausto', 'Gaspar', 'Livio', 'Mateo', 'Nico'],
    last: ['Bellavista', 'Castellan', 'Dorado', 'Giralda', 'Marisol', 'Solano', 'Torrente', 'Valdora', 'Zafiro', 'Quintara'],
  },
]

/** Share of players in each position. Goalkeepers are rarer, as in a real squad. */
const POSITION_SHARE: Record<Position, number> = { GK: 0.14, DEF: 0.3, MID: 0.3, FWD: 0.26 }

/** Whole-number counts that follow `share` as closely as possible and add up to `total` (largest remainder). */
function quotas<K extends string>(keys: readonly K[], share: Record<K, number>, total: number): Record<K, number> {
  const exact = keys.map(key => ({ key, value: share[key] * total }))
  const counts = Object.fromEntries(exact.map(({ key, value }) => [key, Math.floor(value)])) as Record<K, number>
  let missing = total - Object.values<number>(counts).reduce((sum, value) => sum + value, 0)
  for (const { key } of [...exact].sort((a, b) => (b.value % 1) - (a.value % 1))) {
    if (missing <= 0)
      break
    counts[key] += 1
    missing -= 1
  }
  return counts
}

function altPositionFor(position: Position, rng: Rng): Position | undefined {
  // About half of outfield players can also play next door. Goalkeepers have no second position.
  if (position === 'GK' || rng.next() >= 0.5)
    return undefined
  if (position === 'DEF')
    return 'MID'
  if (position === 'FWD')
    return 'MID'
  return rng.pick(['DEF', 'FWD'] as const)
}

/**
 * Builds the player catalogue from a seed: the same seed gives the same 200 players. Every rarity has every position,
 * the four nations are balanced, and every name is unique. The result is saved to the database once; after that the
 * admin edits it and the seed is no longer used.
 */
export function generateCatalogue(config: GameConfig, seed: number | string = 'pixel-pitch-catalogue'): Player[] {
  const rng = createRng(seed)
  const usedNames = new Set<string>()
  const players: Player[] = []

  for (const rarity of RARITIES) {
    const count = config.cards.catalogueCounts[rarity]
    const [low, high] = config.cards.ratingBands[rarity]
    const positionCounts = quotas(POSITIONS, POSITION_SHARE, count)
    const positions = rng.shuffle(POSITIONS.flatMap(position => Array.from({ length: positionCounts[position] }, () => position)))
    const nations = rng.shuffle(Array.from({ length: count }, (_, index) => index % NATION_COUNT))

    for (let index = 0; index < count; index++) {
      const nation = nations[index]
      const pool = NAMES[nation]
      let name = ''
      for (let attempt = 0; attempt < 200 && (!name || usedNames.has(name)); attempt++)
        name = `${rng.pick(pool.first)} ${rng.pick(pool.last)}`
      if (usedNames.has(name))
        throw new Error('Ran out of unique names; add more to the name pools.')
      usedNames.add(name)

      const position = positions[index]
      players.push({
        id: `p${String(players.length + 1).padStart(3, '0')}`,
        name,
        nation,
        position,
        altPosition: altPositionFor(position, rng),
        rarity,
        rating: rng.int(low, high),
        sprite: { skin: rng.int(0, SKIN_TONES - 1), hairStyle: rng.int(0, HAIR_STYLES.length - 1), hairColour: rng.int(0, HAIR_COLOURS.length - 1) },
      })
    }
  }
  return players
}
