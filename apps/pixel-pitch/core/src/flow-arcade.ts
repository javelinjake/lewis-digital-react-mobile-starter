import type { Cabinet, ClubState, Ticket } from './club-state'
import type { FlowContext, FlowResult, LedgerEntry } from './flow'
import type { WarmupZone } from './match'
import { dayIndex, pendingTrayTokens } from './advance'
import { GameRuleError } from './errors'
import { bump, usedToday } from './flow-packs'
import { warmupBonus } from './match'
import { KEEPY_STEPS_PER_SECOND, runKeepy, scoreKick, shareOf, warmupZone } from './minigames'
import { addXp, recordProgress } from './progress'

/** A play that was never finished is stopped after this long. */
const TICKET_LIFE_MS = 10 * 60_000

const isCabinet = (value: unknown): value is Cabinet => value === 'kick' || value === 'keepy'

export function freePlaysPerDay(state: Pick<ClubState, 'idle'>, config: FlowContext['config']) {
  return state.idle.hasPass ? config.cabinets.freePlaysPerDayWithPass : config.cabinets.freePlaysPerDay
}

export function freePlaysLeft(state: ClubState, cabinet: Cabinet, config: FlowContext['config'], now: number) {
  return Math.max(0, freePlaysPerDay(state, config) - usedToday(state.cabinetPlays[cabinet], dayIndex(now, config)))
}

function issue(state: ClubState, kind: Ticket['kind'], paid: boolean, clubId: string | number, now: number): ClubState {
  const number = state.ticketsIssued + 1
  return { ...state, ticketsIssued: number, ticket: { id: String(number), kind, seed: `${clubId}:${kind}:${number}`, issuedAt: now, paid } }
}

/** Empties a cabinet's token tray into the wallet. The tray fills while the player is away, up to 8 hours' worth (12 with the Pass). */
export function collectTray(ctx: FlowContext, cabinet: Cabinet): FlowResult<{ tokens: number }> {
  const { state, config, now } = ctx
  if (!isCabinet(cabinet))
    throw new GameRuleError('cabinet', 'There is no such cabinet.')
  const tokens = pendingTrayTokens(state.idle, config, cabinet, now)
  if (tokens < 1)
    throw new GameRuleError('empty', 'The tray is empty.')
  return {
    state: { ...state, tokens: state.tokens + tokens, idle: { ...state.idle, trayCollectedAt: { ...state.idle.trayCollectedAt, [cabinet]: now } } },
    ledger: [{ currency: 'tokens', amount: tokens, reason: 'tray', ref: cabinet }],
    extra: { tokens },
  }
}

/**
 * Starts a play of a cabinet: three free a day (four with the Pass), then 20 gems each. A play bought with gems pays
 * coins and Pass XP, never tokens, because tokens buy random packs. The ticket (in the state) carries the seed.
 */
export function startPlay(ctx: FlowContext, cabinet: Cabinet, paid: boolean): FlowResult {
  const { state, config, now } = ctx
  if (!isCabinet(cabinet))
    throw new GameRuleError('cabinet', 'There is no such cabinet.')
  const day = dayIndex(now, config)
  const ledger: LedgerEntry[] = []
  let next = state

  if (paid) {
    if (state.idle.gems < config.cabinets.gemPlayCost)
      throw new GameRuleError('gems', `An extra play costs ${config.cabinets.gemPlayCost} gems.`)
    next = { ...next, idle: { ...next.idle, gems: next.idle.gems - config.cabinets.gemPlayCost } }
    ledger.push({ currency: 'gems', amount: -config.cabinets.gemPlayCost, reason: 'arcade-play', ref: cabinet })
  }
  else {
    if (freePlaysLeft(state, cabinet, config, now) < 1)
      throw new GameRuleError('no-plays', 'No free plays left today. Come back tomorrow, or use gems.')
    next = { ...next, cabinetPlays: { ...next.cabinetPlays, [cabinet]: bump(next.cabinetPlays[cabinet], day) } }
  }
  return { state: issue(next, cabinet, paid, ctx.clubId, now), ledger }
}

export interface PlayResult {
  score: number
  max: number
  tokens: number
  coins: number
}

/** Checks a play's taps are those of a person, and that the play took at least as long as its taps say. */
function checkTiming(ticket: Ticket, lastTapMs: number, ctx: FlowContext) {
  const elapsed = ctx.now - ticket.issuedAt
  if (elapsed > TICKET_LIFE_MS)
    throw new GameRuleError('expired', 'That play timed out. Start another.')
  if (elapsed < lastTapMs * ctx.config.minigames.clockSlack)
    throw new GameRuleError('too-fast', 'That play was faster than a play can be.')
}

/** Scores a finished play from its taps and pays it. Kick Timer: `taps` are milliseconds into each round. Keepy-Uppy: the 60 Hz steps tapped on. */
export function finishPlay(ctx: FlowContext, cabinet: Cabinet, taps: readonly number[]): FlowResult<PlayResult> {
  const { state, config } = ctx
  const ticket = state.ticket
  if (!ticket || ticket.kind !== cabinet)
    throw new GameRuleError('no-ticket', 'Start a play first.')
  if (!Array.isArray(taps) || taps.some(tap => typeof tap !== 'number' || !Number.isFinite(tap) || tap < 0))
    throw new GameRuleError('taps', 'Those taps are not valid.')
  const { minTapGapMs } = config.minigames

  let score: number
  let max: number
  if (cabinet === 'kick') {
    if (taps.some(tap => tap < minTapGapMs))
      throw new GameRuleError('taps', 'A kick cannot be taken that quickly.')
    try {
      const result = scoreKick(ticket.seed, taps, config)
      score = result.total
      max = result.max
    }
    catch {
      throw new GameRuleError('taps', 'A Kick Timer play has one tap for each kick.')
    }
    checkTiming(ticket, taps.reduce((sum, tap) => sum + tap, 0), ctx)
  }
  else {
    const minGap = Math.ceil((minTapGapMs * KEEPY_STEPS_PER_SECOND) / 1000)
    const ordered = taps.every((tap, index) => Number.isInteger(tap) && (index === 0 || tap - taps[index - 1] >= minGap))
    if (!ordered || taps.length > config.minigames.keepy.maxKicks * 4)
      throw new GameRuleError('taps', 'Those taps are not valid.')
    const result = runKeepy(ticket.seed, taps, config)
    score = result.kicks
    max = config.minigames.keepy.maxKicks
    checkTiming(ticket, (result.steps * 1000) / KEEPY_STEPS_PER_SECOND, ctx)
  }

  const tokens = ticket.paid ? 0 : shareOf(score, max, config.cabinets.playMaxTokens)
  const coins = ticket.paid ? shareOf(score, max, config.cabinets.gemPlayCoins) : 0
  const ledger: LedgerEntry[] = []
  if (tokens > 0)
    ledger.push({ currency: 'tokens', amount: tokens, reason: 'arcade', ref: cabinet })
  if (coins > 0)
    ledger.push({ currency: 'coins', amount: coins, reason: 'arcade', ref: cabinet })

  const paid: ClubState = { ...state, ticket: null, tokens: state.tokens + tokens, coins: state.coins + coins }
  return {
    state: addXp(recordProgress(paid, 'playCabinets'), config.pass.xp.cabinet, config),
    ledger,
    extra: { score, max, tokens, coins },
  }
}

/** Starts the warm-up kick for the next match. One try for each match. */
export function startWarmup(ctx: FlowContext): FlowResult {
  const { state, now } = ctx
  if (state.warmupTriedFor === state.league.fixtureNo)
    throw new GameRuleError('warmup-used', 'You have already warmed up for this match.')
  return { state: issue({ ...state, warmupTriedFor: state.league.fixtureNo }, 'warmup', false, ctx.clubId, now) }
}

/** Finishes the warm-up kick: gold is +10% attack in the next match, green +5%, a miss +2%. */
export function finishWarmup(ctx: FlowContext, tapMs: number): FlowResult<{ zone: WarmupZone, bonus: number }> {
  const { state, config } = ctx
  const ticket = state.ticket
  if (!ticket || ticket.kind !== 'warmup')
    throw new GameRuleError('no-ticket', 'Start the warm-up first.')
  if (typeof tapMs !== 'number' || !Number.isFinite(tapMs) || tapMs < config.minigames.minTapGapMs)
    throw new GameRuleError('taps', 'That tap is not valid.')
  checkTiming(ticket, tapMs, ctx)

  const zone = warmupZone(ticket.seed, tapMs, config)
  const bonus = warmupBonus(zone, config)
  return { state: { ...state, ticket: null, league: { ...state.league, warmupBonus: bonus } }, extra: { zone, bonus } }
}
