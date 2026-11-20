import type { FlowContext, FlowResult } from './flow'
import type { Reward } from './config'
import { dayIndex } from './advance'
import { albumSets, isSetComplete } from './album'
import { GameRuleError } from './errors'
import { addXp, grantReward, tierReached } from './progress'

export const CALENDAR_DAYS = 7

/** Pays a goal's reward when it has been done. It also earns Pass XP. */
export function claimGoal(ctx: FlowContext, goalId: string): FlowResult<{ reward: Reward }> {
  const { state, config } = ctx
  const goal = state.daily.goals.find(entry => entry.id === goalId)
  const definition = config.daily.goals.find(entry => entry.id === goalId)
  if (!goal || !definition)
    throw new GameRuleError('no-goal', 'That is not one of today\'s goals.')
  if (goal.claimed)
    throw new GameRuleError('claimed', 'You have already claimed that goal.')
  if (goal.progress < goal.target)
    throw new GameRuleError('unfinished', 'That goal is not done yet.')

  const marked = { ...state, daily: { ...state.daily, goals: state.daily.goals.map(entry => (entry.id === goalId ? { ...entry, claimed: true } : entry)) } }
  const paid = grantReward(marked, definition.reward, 'goal', goalId)
  return { state: addXp(paid.state, config.pass.xp.goal, config), ledger: paid.ledger, extra: { reward: definition.reward } }
}

/** The Daily Free Pack: one a day, straight onto the shelf (even if the shelf is full). */
export function claimFreePack(ctx: FlowContext): FlowResult<{ packs: number }> {
  const { state, config } = ctx
  if (state.daily.freePackClaimed)
    throw new GameRuleError('claimed', 'You have already taken today\'s free pack.')
  const packs = config.daily.freePackCount
  return {
    state: { ...state, daily: { ...state.daily, freePackClaimed: true }, idle: { ...state.idle, shelfPacks: state.idle.shelfPacks + packs } },
    extra: { packs },
  }
}

/** What the next calendar claim would be: the day number (1 to 7) it would be, given today. */
export function nextCalendarDay(calendar: { streak: number, lastClaimDay: number }, day: number) {
  if (calendar.lastClaimDay === day)
    return null
  if (calendar.lastClaimDay === day - 1 && calendar.streak < CALENDAR_DAYS)
    return calendar.streak + 1
  return 1
}

/**
 * The 7-day login calendar: claim every day for the next reward, ending in a Star pack on day 7. Missing a day starts
 * again at day 1, and so does the day after claiming day 7.
 */
export function claimCalendar(ctx: FlowContext): FlowResult<{ day: number, reward: Reward }> {
  const { state, config, now } = ctx
  const today = dayIndex(now, config)
  const day = nextCalendarDay(state.calendar, today)
  if (day === null)
    throw new GameRuleError('claimed', 'You have already claimed today\'s reward. Come back tomorrow.')
  const reward = config.calendar.rewards[day - 1]
  const paid = grantReward({ ...state, calendar: { streak: day, lastClaimDay: today } }, reward, 'calendar', String(day))
  return { state: paid.state, ledger: paid.ledger, extra: { day, reward } }
}

export type PassTrack = 'free' | 'premium'

/** Claims one tier of the Pass. The free track is for everyone; the premium track needs the League Pass. A late Pass unlocks every tier already reached. */
export function claimPassTier(ctx: FlowContext, track: PassTrack, tier: number): FlowResult<{ reward: Reward }> {
  const { state, config } = ctx
  if (track !== 'free' && track !== 'premium')
    throw new GameRuleError('track', 'Choose the free or the premium track.')
  if (!Number.isInteger(tier) || tier < 1 || tier > config.pass.premium.length)
    throw new GameRuleError('tier', 'There is no such tier.')
  if (tier > tierReached(state, config))
    throw new GameRuleError('locked', 'You have not reached that tier yet.')
  if (track === 'premium' && !state.idle.hasPass)
    throw new GameRuleError('no-pass', 'The premium track needs the League Pass.')

  const claimed = track === 'free' ? state.pass.claimedFree : state.pass.claimedPremium
  if (claimed.includes(tier))
    throw new GameRuleError('claimed', 'You have already claimed that tier.')
  const reward = track === 'free' ? config.pass.free[tier - 1] : config.pass.premium[tier - 1]
  if (!reward)
    throw new GameRuleError('no-reward', 'There is no reward on that tier.')

  const marked = { ...state, pass: { ...state.pass, [track === 'free' ? 'claimedFree' : 'claimedPremium']: [...claimed, tier] } }
  const paid = grantReward(marked, reward, 'pass', `${track}-${tier}`)
  return { state: paid.state, ledger: paid.ledger, extra: { reward } }
}

/** Pays the reward for a finished album set, once. */
export function claimAlbumSet(ctx: FlowContext, setId: string): FlowResult<{ reward: Reward }> {
  const { state, config } = ctx
  const set = albumSets(ctx.catalogue, config).find(entry => entry.id === setId)
  if (!set)
    throw new GameRuleError('no-set', 'There is no such set.')
  if (state.album.claimed.includes(setId))
    throw new GameRuleError('claimed', 'You have already claimed that set.')
  if (!isSetComplete(set, state.album.collected))
    throw new GameRuleError('unfinished', 'That set is not finished yet.')

  const marked = { ...state, album: { ...state.album, claimed: [...state.album.claimed, setId] } }
  const paid = grantReward(marked, config.album.reward, 'album', setId)
  return { state: paid.state, ledger: paid.ledger, extra: { reward: config.album.reward } }
}
