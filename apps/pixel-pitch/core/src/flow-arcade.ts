import type { AnyTaps, CabinetTaps } from './arcade-taps'
import type { Cabinet, ClubState, Ticket } from './club-state'
import type { GameConfig } from './config'
import type { FlowContext, FlowResult, LedgerEntry } from './flow'
import type { WarmupZone } from './match'
import { createRng, hashSeed } from '@ld/utils/random/rng'
import { dayIndex, pendingTrayTokens } from './advance'
import { scorePlay } from './arcade-taps'
import { playConfig } from './play-config'
import { CABINETS, isCabinet } from './club-state'
import { spendEnergy } from './energy'
import { GameRuleError } from './errors'
import { warmupBonus } from './match'
import { shareOf } from './minigames'
import { addXp, recordProgress } from './progress'

/** A play that was never finished is stopped after this long. */
const TICKET_LIFE_MS = 10 * 60_000

/** The cabinet that pays extra tokens today. They take turns, a day each, so each is worth a visit. */
export function hotCabinet(now: number, config: FlowContext['config']): Cabinet {
  const day = dayIndex(now, config)
  return CABINETS[((day % CABINETS.length) + CABINETS.length) % CABINETS.length]
}

function issue(state: ClubState, kind: Ticket['kind'], paid: boolean, clubId: string | number, now: number, cabinet?: Cabinet): ClubState {
  const number = state.ticketsIssued + 1
  const ticket: Ticket = { id: String(number), kind, seed: `${clubId}:${kind}:${number}`, issuedAt: now, paid, tier: state.league.tier, ...(cabinet ? { cabinet } : {}) }
  return { ...state, ticketsIssued: number, ticket }
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
export function checkTiming(ticket: Ticket, lastTapMs: number, ctx: FlowContext) {
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
  const { score, max, playMs } = scorePlay(cabinet, ticket.seed, taps, playConfig(config, ticket))
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

/**
 * The arcade game the warm-up for a league match is a play of. Drawn from the club and the match, so it is the same
 * game however often the player looks, and a different one from match to match.
 */
export function warmupCabinet(clubId: string | number, fixtureNo: number): Cabinet {
  return createRng(hashSeed(String(clubId), 'warmup', fixtureNo)).pick(CABINETS)
}

/** What a warm-up comes to: at least `minigames.warmup.gold` of the game's top score is gold, `green` is green. */
export function warmupZone(score: number, max: number, config: Pick<GameConfig, 'minigames'>): WarmupZone {
  const share = max > 0 ? Math.max(0, score) / max : 0
  const { gold, green } = config.minigames.warmup
  return share >= gold ? 'gold' : share >= green ? 'green' : 'miss'
}

/** Starts the warm-up for the next match: a play of the match's arcade game. Free, and one try for each match. */
export function startWarmup(ctx: FlowContext): FlowResult {
  const { state, now } = ctx
  if (state.warmupTriedFor === state.league.fixtureNo)
    throw new GameRuleError('warmup-used', 'You have already warmed up for this match.')
  const cabinet = warmupCabinet(ctx.clubId, state.league.fixtureNo)
  return { state: issue({ ...state, warmupTriedFor: state.league.fixtureNo }, 'warmup', false, ctx.clubId, now, cabinet) }
}

export interface WarmupResult {
  cabinet: Cabinet
  score: number
  max: number
  zone: WarmupZone
  /** The ATT bonus the next league match gets, as a fraction (0.1 is +10%). */
  bonus: number
}

/**
 * Finishes the warm-up from the game's taps (the same shape as a play of that cabinet), replayed with the ticket's
 * seed. The share of the top score sets the bonus: gold is +10% attack in the next match, green +5%, anything else
 * +2%. It pays nothing else: no tokens, coins, best score, goal progress or Pass XP.
 */
export function finishWarmup(ctx: FlowContext, taps: AnyTaps): FlowResult<WarmupResult> {
  const { state, config } = ctx
  const ticket = state.ticket
  if (!ticket || ticket.kind !== 'warmup' || !isCabinet(ticket.cabinet))
    throw new GameRuleError('no-ticket', 'Start the warm-up first.')
  const cabinet = ticket.cabinet
  const { score, max, playMs } = scorePlay(cabinet, ticket.seed, taps, playConfig(config, ticket))
  checkTiming(ticket, playMs, ctx)

  const zone = warmupZone(score, max, config)
  const bonus = warmupBonus(zone, config)
  return { state: { ...state, ticket: null, league: { ...state.league, warmupBonus: bonus } }, extra: { cabinet, score, max, zone, bonus } }
}
