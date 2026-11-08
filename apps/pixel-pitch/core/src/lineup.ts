import type { FormationId, Position, PositionedPlayer } from './positions'
import { FORMATIONS, positionFit, ROLE_WEIGHTS } from './positions'

/** What the rules need to know about a player in a slot. `rating` is the card's rating including stars and training. */
export interface Fielded extends PositionedPlayer {
  rating: number
  nation: number
}

export interface SlotScore {
  role: string
  /** 0 for an empty slot. */
  fit: number
  /** rating × fit, 0 for an empty slot. */
  score: number
}

export interface LineupScore {
  slots: SlotScore[]
  /** Mean of the slot scores, before chemistry. */
  average: number
  /** Bonus from players of one nation: 0, 0.03, 0.05 or 0.08. */
  chemistry: number
  /** Whole number shown on the squad screen. */
  overall: number
  /** Exact values. The match uses these, not the rounded display. */
  exact: number
  att: number
  def: number
}

/** 3 players from one nation +3%, 4 +5%, all 5 +8%. */
export function chemistryBonus(topNationCount: number): number {
  return topNationCount >= 5 ? 0.08 : topNationCount === 4 ? 0.05 : topNationCount === 3 ? 0.03 : 0
}

export const SLOT_COUNT = 5

/** Scores a lineup: `players[i]` plays slot `i` of the formation, `null` leaves it empty. */
export function scoreLineup(formation: FormationId, players: ReadonlyArray<Fielded | null>): LineupScore {
  const roles = FORMATIONS[formation].roles
  const nations: number[] = []
  let sum = 0
  let attSum = 0
  let defSum = 0

  const slots = roles.map((role, index) => {
    const player = players[index] ?? null
    if (!player)
      return { role, fit: 0, score: 0 }

    const fit = positionFit(player, role)
    const score = player.rating * fit
    sum += score
    attSum += score * ROLE_WEIGHTS[role].att
    defSum += score * ROLE_WEIGHTS[role].def
    nations[player.nation] = (nations[player.nation] ?? 0) + 1
    return { role, fit, score }
  })

  const chemistry = chemistryBonus(Math.max(0, ...nations.filter(Boolean)))
  const average = sum / SLOT_COUNT
  const exact = average * (1 + chemistry)

  return {
    slots,
    average,
    chemistry,
    overall: Math.round(exact),
    exact,
    // ATT is split over the two attacking-minded slots' worth of weight, DEF over three.
    att: (attSum / 2) * (1 + chemistry),
    def: (defSum / 3) * (1 + chemistry),
  }
}

export interface PoolPlayer extends Fielded {
  id: string
}

export interface AutoPickResult {
  /** Player ids in slot order, one per slot. Empty if the pool has no one. */
  ids: string[]
  exact: number
}

const POOL_LIMIT = 12

/**
 * The players worth trying. Ranking everyone by their best single slot would drop a goalkeeper, because a keeper only
 * shines in goal, so the best few for every role in the formation are always kept, and the rest of the 12 places go
 * to whoever is best overall.
 */
function chooseCandidates(roles: readonly Position[], pool: readonly PoolPlayer[]): PoolPlayer[] {
  const chosen = new Set<PoolPlayer>()

  for (const role of new Set(roles)) {
    const slotsForRole = roles.filter(entry => entry === role).length
    const best = [...pool].sort((a, b) => b.rating * positionFit(b, role) - a.rating * positionFit(a, role))
    for (const player of best.slice(0, slotsForRole + 1))
      chosen.add(player)
  }

  const bestSlot = (player: Fielded) => Math.max(...roles.map(role => player.rating * positionFit(player, role)))
  for (const player of [...pool].sort((a, b) => bestSlot(b) - bestSlot(a))) {
    if (chosen.size >= POOL_LIMIT)
      break
    chosen.add(player)
  }
  return [...chosen]
}

/**
 * The best lineup for a formation from a pool. At most 12 players are tried (see `chooseCandidates`), which keeps the
 * search to 12×11×10×9×8 = 95,040 arrangements. It tries all of them, so within those 12 the answer is the true best,
 * and it runs in a few milliseconds.
 */
export function autoPick(formation: FormationId, pool: readonly PoolPlayer[]): AutoPickResult {
  const roles = FORMATIONS[formation].roles
  const candidates = chooseCandidates(roles, pool)
  if (candidates.length === 0)
    return { ids: [], exact: 0 }

  const count = candidates.length
  const slots = Math.min(SLOT_COUNT, count)
  const score = candidates.map(player => roles.map(role => player.rating * positionFit(player, role)))
  const nationCounts = new Array<number>(8).fill(0)

  let best = -1
  let bestIds: number[] = []
  const chosen: number[] = []
  const used = new Array<boolean>(count).fill(false)

  const visit = (slot: number, sum: number, top: number) => {
    if (slot === slots) {
      const total = (sum / SLOT_COUNT) * (1 + chemistryBonus(top))
      if (total > best + 1e-9) {
        best = total
        bestIds = [...chosen]
      }
      return
    }
    for (let index = 0; index < count; index++) {
      if (used[index])
        continue
      used[index] = true
      chosen[slot] = index
      const nation = candidates[index].nation
      nationCounts[nation] += 1
      visit(slot + 1, sum + score[index][slot], Math.max(top, nationCounts[nation]))
      nationCounts[nation] -= 1
      used[index] = false
    }
  }
  visit(0, 0, 0)

  return { ids: bestIds.map(index => candidates[index].id), exact: best }
}

export interface UpgradeResult {
  /** How much the lineup's exact score rises if the candidate takes the slot that helps most. 0 if it would not help. */
  delta: number
  slot: number | null
}

/** Would this player improve the current lineup? Used for the UPGRADE badge when a card is revealed. */
export function upgradeDelta(formation: FormationId, lineup: ReadonlyArray<Fielded | null>, candidate: Fielded): UpgradeResult {
  const current = scoreLineup(formation, lineup).exact
  let best: UpgradeResult = { delta: 0, slot: null }

  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const trial = Array.from({ length: SLOT_COUNT }, (_, index) => (index === slot ? candidate : lineup[index] ?? null))
    const delta = scoreLineup(formation, trial).exact - current
    if (delta > best.delta)
      best = { delta, slot }
  }
  return best
}
