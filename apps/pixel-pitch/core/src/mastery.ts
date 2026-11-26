import type { Cabinet, ClubState } from './club-state'
import type { GameConfig, Reward } from './config'
import type { LedgerEntry } from './flow'
import { cabinetMax } from './arcade-taps'
import { grantReward } from './progress'

// Mastery: every arcade game has bronze, silver and gold score targets in every league, so a play is something to
// get better at and not only a way to earn tokens. The games are quicker in each league, so the same share of the top
// score is harder to reach higher up. The first time each medal is earned it pays once; medals are for good.

export const MEDALS = ['bronze', 'silver', 'gold'] as const
export type Medal = typeof MEDALS[number]

/** Where a game's best and medal in a league are kept. */
export const masteryKey = (cabinet: Cabinet, tier: number) => `${cabinet}:${Math.max(1, tier)}`

/** The scores for bronze, silver and gold in a game: shares of its top score, rounded up. */
export function medalTargets(cabinet: Cabinet, config: GameConfig): [number, number, number] {
  const max = cabinetMax(cabinet, config)
  const shares = config.mastery.shares[cabinet]
  return [0, 1, 2].map(index => Math.max(1, Math.ceil(shares[index] * max))) as [number, number, number]
}

/** 0 for no medal, 1 bronze, 2 silver, 3 gold. */
export function medalLevel(score: number, targets: readonly number[]): number {
  return targets.filter(target => score >= target).length
}

/** The best score in a game in a league (0 if never played there). */
export function bestIn(state: Pick<ClubState, 'arcade'>, cabinet: Cabinet, tier: number): number {
  return state.arcade.bests[masteryKey(cabinet, tier)] ?? 0
}

/** The medal held in a game in a league: 0 to 3. */
export function medalIn(state: Pick<ClubState, 'arcade'>, cabinet: Cabinet, tier: number): number {
  return state.arcade.medals[masteryKey(cabinet, tier)] ?? 0
}

export interface MasteryResult {
  state: ClubState
  /** The best in this game and league before this play. */
  previousBest: number
  newBest: boolean
  /** Medals earned for the first time by this play, lowest first. */
  medals: Medal[]
  rewards: Reward[]
  ledger: LedgerEntry[]
}

/**
 * Records a play's score in its league: the personal best, and any medal reached for the first time, paid once each.
 * A play bought with gems (`awards` false) keeps its best but earns no medal: silver pays tokens, and tokens buy random
 * packs, so gems must never turn into them. The next free play that reaches the medal earns it.
 */
export function recordMastery(state: ClubState, cabinet: Cabinet, tier: number, score: number, config: GameConfig, awards = true): MasteryResult {
  const key = masteryKey(cabinet, tier)
  const previousBest = bestIn(state, cabinet, tier)
  const held = medalIn(state, cabinet, tier)
  const reached = awards ? medalLevel(score, medalTargets(cabinet, config)) : 0
  let next: ClubState = {
    ...state,
    arcade: {
      ...state.arcade,
      best: { ...state.arcade.best, [cabinet]: Math.max(state.arcade.best[cabinet] ?? 0, score) },
      bests: { ...state.arcade.bests, [key]: Math.max(previousBest, score) },
      medals: reached > held ? { ...state.arcade.medals, [key]: reached } : state.arcade.medals,
    },
  }
  const medals = MEDALS.slice(held, Math.max(held, reached))
  const rewards: Reward[] = []
  const ledger: LedgerEntry[] = []
  for (const medal of medals) {
    const reward = config.mastery.rewards[medal]
    const paid = grantReward(next, reward, 'medal', `${key}:${medal}`)
    next = paid.state
    rewards.push(reward)
    ledger.push(...paid.ledger)
  }
  return { state: next, previousBest, newBest: score > previousBest, medals, rewards, ledger }
}
