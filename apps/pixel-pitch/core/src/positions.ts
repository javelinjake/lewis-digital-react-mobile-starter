export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'
export type FormationId = '2-2' | '1-2-1' | '2-1-1' | '3-1' | '1-1-2'
export type Rarity = 'grassroots' | 'semipro' | 'pro' | 'star' | 'legend'

export const RARITIES: readonly Rarity[] = ['grassroots', 'semipro', 'pro', 'star', 'legend']
export const POSITIONS: readonly Position[] = ['GK', 'DEF', 'MID', 'FWD']
export const NATION_COUNT = 4

/** Lines run GK, DEF, MID, FWD. A player one line from their slot is "close", two lines is "far". */
const LINE: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

/** How much of its rating a slot role takes for attack and for defence. */
export const ROLE_WEIGHTS: Record<Position, { att: number, def: number }> = {
  GK: { att: 0, def: 1 },
  DEF: { att: 0.2, def: 0.8 },
  MID: { att: 0.5, def: 0.5 },
  FWD: { att: 0.9, def: 0.1 },
}

export interface Formation {
  id: FormationId
  name: string
  /** The role each of the five slots plays, ending with the goalkeeper. */
  roles: readonly [Position, Position, Position, Position, Position]
}

export const FORMATIONS: Record<FormationId, Formation> = {
  '2-2': { id: '2-2', name: 'Box', roles: ['FWD', 'FWD', 'DEF', 'DEF', 'GK'] },
  '1-2-1': { id: '1-2-1', name: 'Diamond', roles: ['FWD', 'MID', 'MID', 'DEF', 'GK'] },
  '2-1-1': { id: '2-1-1', name: 'Pyramid', roles: ['FWD', 'MID', 'DEF', 'DEF', 'GK'] },
  '3-1': { id: '3-1', name: 'Wall', roles: ['FWD', 'DEF', 'DEF', 'DEF', 'GK'] },
  '1-1-2': { id: '1-1-2', name: 'Blitz', roles: ['FWD', 'FWD', 'MID', 'DEF', 'GK'] },
}

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[]

export interface PositionedPlayer {
  position: Position
  altPosition?: Position
}

/**
 * How well a player fills a role, as a fraction of their rating:
 * 100% in their main position, 90% in their secondary, 75% one line away, 55% two or more lines away,
 * and 30% when a goalkeeper plays out or an outfielder plays in goal.
 */
export function positionFit(player: PositionedPlayer, role: Position): number {
  if (player.position === role)
    return 1
  if (player.altPosition === role)
    return 0.9
  if (player.position === 'GK' || role === 'GK')
    return 0.3
  return Math.abs(LINE[player.position] - LINE[role]) === 1 ? 0.75 : 0.55
}

export function isFormationId(value: string): value is FormationId {
  return value in FORMATIONS
}
