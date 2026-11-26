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

/**
 * Starts a fresh season when the 4-week season has changed. Whatever the old season reached on the Pass but nobody
 * claimed is paid first (the premium track too, if the Pass was bought for that season), so nothing earned is lost.
 */
export function closeSeason(state: ClubState, now: number, config: GameConfig): { state: ClubState, rewards: Reward[], ledger: LedgerEntry[] } {
  const season = seasonOf(now, config)
  if (state.pass.season >= season)
    return { state, rewards: [], ledger: [] }
  let next = state
  const rewards: Reward[] = []
  const ledger: LedgerEntry[] = []
  if (state.pass.season >= 0) {
    const premium = state.idle.passSeason === state.pass.season
    for (let tier = 1; tier <= tierReached(state, config); tier++) {
      const free = config.pass.free[tier - 1]
      const paid = config.pass.premium[tier - 1]
      for (const [reward, owed] of [[free, !state.pass.claimedFree.includes(tier)], [paid, premium && !state.pass.claimedPremium.includes(tier)]] as const) {
        if (!reward || !owed)
          continue
        const granted = grantReward(next, reward, 'season-end', `tier-${tier}`)
        next = granted.state
        ledger.push(...granted.ledger)
        rewards.push(reward)
      }
    }
  }
  return { state: { ...next, pass: { season, xp: 0, claimedFree: [], claimedPremium: [] } }, rewards, ledger }
}

/** Starts a fresh season (see `closeSeason`, which also pays what was left unclaimed). */
export function rollSeason(state: ClubState, now: number, config: GameConfig): ClubState {
  return closeSeason(state, now, config).state
}

/** Whether the League Pass covers the season at `now`. */
export function passActive(state: Pick<ClubState, 'idle'>, now: number, config: GameConfig) {
  return state.idle.passSeason === seasonOf(now, config)
}

/** Days left in the season at `now`, counting today. */
export function seasonDaysLeft(now: number, config: GameConfig) {
  return config.pass.seasonDays - (dayIndex(now, config) % config.pass.seasonDays)
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
    case 'signing':
      return { state: { ...state, signings: { ...state.signings, pending: state.signings.pending + reward.amount } }, ledger: [] }
    case 'kit':
      return { state: reward.id && !state.kits.includes(reward.id) ? { ...state, kits: [...state.kits, reward.id] } : state, ledger: [] }
  }
}

export function describeReward(reward: Reward, config?: Pick<GameConfig, 'cosmetics'>): string {
  if (reward.kind === 'kit')
    return `${config?.cosmetics.kits.find(kit => kit.id === reward.id)?.name ?? 'Premium'} kit`
  if (reward.kind === 'signing')
    return reward.amount === 1 ? 'Star Signing' : `${reward.amount} Star Signings`
  const noun = { coins: 'coins', gems: 'gems', tokens: 'tokens', packs: 'pack', starPacks: 'Star pack' }[reward.kind]
  return reward.kind === 'packs' || reward.kind === 'starPacks' ? `${reward.amount} ${noun}${reward.amount === 1 ? '' : 's'}` : `${reward.amount.toLocaleString('en-GB')} ${noun}`
}
