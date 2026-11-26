import type { CabinetTaps } from './arcade-taps'
import type { Cabinet, ClubState, Ticket } from './club-state'
import type { FlowContext, FlowResult, LedgerEntry } from './flow'
import type { WarmupZone } from './match'
import { dayIndex, pendingTrayTokens } from './advance'
import { scorePlay } from './arcade-taps'
import { CABINETS } from './club-state'
import { spendEnergy } from './energy'
import { GameRuleError } from './errors'
import { warmupBonus } from './match'
import { shareOf, warmupZone } from './minigames'
import { addXp, recordProgress } from './progress'

/** A play that was never finished is stopped after this long. */
const TICKET_LIFE_MS = 10 * 60_000

const isCabinet = (value: unknown): value is Cabinet => CABINETS.includes(value as Cabinet)

/** The cabinet that pays extra tokens today. They take turns, a day each, so each is worth a visit. */
export function hotCabinet(now: number, config: FlowContext['config']): Cabinet {
  const day = dayIndex(now, config)
  return CABINETS[((day % CABINETS.length) + CABINETS.length) % CABINETS.length]
}

function issue(state: ClubState, kind: Ticket['kind'], paid: boolean, clubId: string | number, now: number): ClubState {
  const number = state.ticketsIssued + 1
  return { ...state, ticketsIssued: number, ticket: { id: String(number), kind, seed: `${clubId}:${kind}:${number}`, issuedAt: now, paid } }
}

/** Empties the arcade's token tray into the wallet. The tray fills while the player is away, up to 8 hours' worth (12 with the Pass). */
export function collectTray(ctx: FlowContext): FlowResult<{ tokens: number }> {
  const { state, config, now } = ctx
  const tokens = pendingTrayTokens(state.idle, config, now)
  if (tokens < 1)
    throw new GameRuleError('empty', 'The tray is empty.')
  return {
    state: { ...state, tokens: state.tokens + tokens, idle: { ...state.idle, trayCollectedAt: now } },
    ledger: [{ currency: 'tokens', amount: tokens, reason: 'tray', ref: 'arcade' }],
    extra: { tokens },
  }
}

/**
 * Starts a play of a cabinet. It costs one energy (see `energyAt`); with none left, 20 gems buy a play that pays
 * coins and Pass XP, never tokens, because tokens buy random packs. The ticket (in the state) carries the seed.
 */
export function startPlay(ctx: FlowContext, cabinet: Cabinet, paid: boolean): FlowResult {
  const { state, config, now } = ctx
  if (!isCabinet(cabinet))
    throw new GameRuleError('cabinet', 'There is no such cabinet.')
  const ledger: LedgerEntry[] = []
  let next = state

  if (paid) {
    if (state.idle.gems < config.cabinets.gemPlayCost)
      throw new GameRuleError('gems', `An extra play costs ${config.cabinets.gemPlayCost} gems.`)
    next = { ...next, idle: { ...next.idle, gems: next.idle.gems - config.cabinets.gemPlayCost } }
    ledger.push({ currency: 'gems', amount: -config.cabinets.gemPlayCost, reason: 'arcade-play', ref: cabinet })
  }
  else {
    next = spendEnergy(next, config, now)
  }
  return { state: issue(next, cabinet, paid, ctx.clubId, now), ledger }
}

export interface PlayResult {
  score: number
  max: number
  tokens: number
  coins: number
  /** The best score in this game before this play. */
  previousBest: number
  newBest: boolean
  /** This was the cabinet of the day, which pays extra tokens. */
  hot: boolean
}

/** Checks a play's taps are those of a person, and that the play took at least as long as its taps say. */
function checkTiming(ticket: Ticket, lastTapMs: number, ctx: FlowContext) {
  const elapsed = ctx.now - ticket.issuedAt
  if (elapsed > TICKET_LIFE_MS)
    throw new GameRuleError('expired', 'That play timed out. Start another.')
  if (elapsed < lastTapMs * ctx.config.minigames.clockSlack)
    throw new GameRuleError('too-fast', 'That play was faster than a play can be.')
}

/**
 * Scores a finished play from what the phone recorded (see `CabinetTaps` for each cabinet's shape) and pays it. The
 * server replays the play with the ticket's seed, so the score is the server's, whatever the phone claims.
 */
export function finishPlay<C extends Cabinet>(ctx: FlowContext, cabinet: C, taps: CabinetTaps[C]): FlowResult<PlayResult> {
  const { state, config } = ctx
  const ticket = state.ticket
  if (!ticket || ticket.kind !== cabinet)
    throw new GameRuleError('no-ticket', 'Start a play first.')
  const { score, max, playMs } = scorePlay(cabinet, ticket.seed, taps, config)
  checkTiming(ticket, playMs, ctx)

  const hot = hotCabinet(ticket.issuedAt, config) === cabinet
  const tokens = ticket.paid ? 0 : Math.floor(shareOf(score, max, config.cabinets.playMaxTokens) * (hot ? 1 + config.cabinets.hotBonus : 1))
  const coins = ticket.paid ? shareOf(score, max, config.cabinets.gemPlayCoins) : 0
  const ledger: LedgerEntry[] = []
  if (tokens > 0)
    ledger.push({ currency: 'tokens', amount: tokens, reason: 'arcade', ref: cabinet })
  if (coins > 0)
    ledger.push({ currency: 'coins', amount: coins, reason: 'arcade', ref: cabinet })

  const previousBest = state.arcade.best[cabinet]
  const newBest = score > previousBest
  const paid: ClubState = {
    ...state,
    ticket: null,
    tokens: state.tokens + tokens,
    coins: state.coins + coins,
    arcade: { best: { ...state.arcade.best, [cabinet]: Math.max(previousBest, score) } },
  }
  return {
    state: addXp(recordProgress(paid, 'playCabinets'), config.pass.xp.cabinet, config),
    ledger,
    extra: { score, max, tokens, coins, previousBest, newBest, hot },
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
