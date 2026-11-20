import type { GameConfig } from './config'
import type { PoolPlayer } from './lineup'
import type { Odds, Side } from './match'
import type { FormationId } from './positions'
import { autoPick, scoreLineup } from './lineup'
import { expectedPoints, matchOdds } from './match'
import { FORMATION_IDS } from './positions'

export interface FormationOption {
  formation: FormationId
  /** The auto-picked lineup for this formation, in slot order. */
  ids: string[]
  att: number
  def: number
  odds: Odds
  /** Average league points against this rival. Options are sorted by this, best first. */
  points: number
}

/**
 * Every formation's best lineup from the squad, ranked by how it would do against one rival. Drives the squad screen's
 * hint ("Diamond is your best reply to their Wall"). Five auto-picks, each a few milliseconds.
 */
export function bestFormation(pool: readonly PoolPlayer[], rival: Side, config: GameConfig, bonus = 0): FormationOption[] {
  const byId = new Map(pool.map(player => [player.id, player]))
  return FORMATION_IDS.map((formation) => {
    const { ids } = autoPick(formation, pool)
    const score = scoreLineup(formation, ids.map(id => byId.get(id) ?? null), bonus)
    const odds = matchOdds({ formation, att: score.att, def: score.def }, rival, config)
    return { formation, ids, att: score.att, def: score.def, odds, points: expectedPoints(odds, config) }
  }).sort((a, b) => b.points - a.points)
}
