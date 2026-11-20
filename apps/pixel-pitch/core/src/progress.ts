import type { ClubState, DailyGoal } from './club-state'
import type { GameConfig, GoalKind, Reward } from './config'
import type { LedgerEntry } from './flow'
import { createRng, hashSeed } from '@ld/utils/random/rng'
import { dayIndex } from './advance'

/** The day's goals: `goalsPerDay` of the pool, no two of one kind, the same for a club all day. */
export function pickGoals(clubId: string | number, day: number, config: GameConfig): DailyGoal[] {
  const rng = createRng(hashSeed(clubId, 'goals', day))
  const kinds = new Set<GoalKind>()
  const chosen: DailyGoal[] = []
  for (const goal of rng.shuffle([...config.daily.goals])) {
    if (kinds.has(goal.kind))
      continue
    kinds.add(goal.kind)
    chosen.push({ id: goal.id, kind: goal.kind, target: goal.target, progress: 0, claimed: false })
    if (chosen.length === config.daily.goalsPerDay)
      break
  }
  return chosen
}

/** Starts a new day's goals (and the Daily Free Pack) when the day has changed. Safe to call as often as you like. */
export function rollDaily(state: ClubState, now: number, clubId: string | number, config: GameConfig): ClubState {
  const day = dayIndex(now, config)
  if (state.daily.day >= day)
    return state
  return { ...state, daily: { day, goals: pickGoals(clubId, day, config), freePackClaimed: false } }
}

/** Counts something towards today's goals. Capped at the target. */
export function recordProgress(state: ClubState, kind: GoalKind, amount = 1): ClubState {
  if (!state.daily.goals.some(goal => goal.kind === kind && goal.progress < goal.target))
    return state
  return { ...state, daily: { ...state.daily, goals: state.daily.goals.map(goal => (goal.kind === kind ? { ...goal, progress: Math.min(goal.target, goal.progress + amount) } : goal)) } }
}

export function seasonOf(now: number, config: GameConfig) {
  return Math.floor(dayIndex(now, config) / config.pass.seasonDays)
}

/** Starts a fresh season (XP and claims reset; what was unclaimed is lost) when the 4-week season has changed. */
export function rollSeason(state: ClubState, now: number, config: GameConfig): ClubState {
  const season = seasonOf(now, config)
  if (state.pass.season >= season)
    return state
  return { ...state, pass: { season, xp: 0, claimedFree: [], claimedPremium: [] } }
}

export function passTiers(config: GameConfig) {
  return config.pass.premium.length
}

export function maxXp(config: GameConfig) {
  return passTiers(config) * config.pass.xpPerTier
}

/** Adds Pass XP, up to the top of the track. */
export function addXp(state: ClubState, amount: number, config: GameConfig): ClubState {
  if (amount <= 0 || state.pass.xp >= maxXp(config))
    return state
  return { ...state, pass: { ...state.pass, xp: Math.min(maxXp(config), state.pass.xp + amount) } }
}

/** How many tiers the player has reached: 0 to 30. */
export function tierReached(state: Pick<ClubState, 'pass'>, config: GameConfig) {
  return Math.min(passTiers(config), Math.floor(state.pass.xp / config.pass.xpPerTier))
}

/** Pays a reward: coins, gems and tokens go to the wallet, packs on the shelf, Star packs in the pack store. */
export function grantReward(state: ClubState, reward: Reward, reason: string, ref?: string): { state: ClubState, ledger: LedgerEntry[] } {
  switch (reward.kind) {
    case 'coins':
      return { state: { ...state, coins: state.coins + reward.amount }, ledger: [{ currency: 'coins', amount: reward.amount, reason, ref }] }
    case 'gems':
      return { state: { ...state, idle: { ...state.idle, gems: state.idle.gems + reward.amount } }, ledger: [{ currency: 'gems', amount: reward.amount, reason, ref }] }
    case 'tokens':
      return { state: { ...state, tokens: state.tokens + reward.amount }, ledger: [{ currency: 'tokens', amount: reward.amount, reason, ref }] }
    case 'packs':
      return { state: { ...state, idle: { ...state.idle, shelfPacks: state.idle.shelfPacks + reward.amount } }, ledger: [] }
    case 'starPacks':
      return { state: { ...state, starPacks: state.starPacks + reward.amount }, ledger: [] }
  }
}

export function describeReward(reward: Reward): string {
  const noun = { coins: 'coins', gems: 'gems', tokens: 'tokens', packs: 'pack', starPacks: 'Star pack' }[reward.kind]
  return reward.kind === 'packs' || reward.kind === 'starPacks' ? `${reward.amount} ${noun}${reward.amount === 1 ? '' : 's'}` : `${reward.amount.toLocaleString('en-GB')} ${noun}`
}
