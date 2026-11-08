import type { GameConfig } from './config'
import type { FormationId } from './positions'

/**
 * Rating points `ours` gains against `theirs` from the formation matchup (negative when theirs has the edge). It is
 * added to our ATT and DEF and taken off theirs, so it is a swing of twice the value.
 */
export function tacticalEdge(ours: FormationId, theirs: FormationId, config: GameConfig): number {
  let edge = 0
  for (const entry of config.formations.edges) {
    if (entry.formation === ours && entry.over === theirs)
      edge += entry.points
    else if (entry.formation === theirs && entry.over === ours)
      edge -= entry.points
  }
  return edge
}
