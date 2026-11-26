import type { GameConfig } from './config'
import type { FlowContext, FlowResult } from './flow'
import type { FixtureResult } from './league'
import type { MatchResult } from './match'
import { hashSeed } from '@ld/utils/random/rng'
import { dayIndex } from './advance'
import { lineupForMatch } from './club'
import { GameRuleError } from './errors'
import { bump, usedToday } from './flow-packs'
import { generateRivals } from './league'
import { scoreLineup } from './lineup'
import { playMatch } from './match'
import { FORMATIONS } from './positions'

/**
 * Friendlies are numbered below the debut (-1): the first is -2, then -3 and on, so every match a club plays has a
 * number of its own and a friendly can never be taken for a league match.
 */
export const friendlyNo = (played: number) => -2 - played

/** Friendlies left today that pay coins. */
export function paidFriendliesLeft(state: FlowContext['state'], config: GameConfig, now: number) {
  return Math.max(0, config.friendly.paidPerDay - usedToday(state.friendlies.paid, dayIndex(now, config)))
}

const coinsFor = (result: MatchResult, config: GameConfig) => (result === 'win' ? config.friendly.winCoins : result === 'draw' ? config.friendly.drawCoins : config.friendly.lossCoins)

/**
 * A friendly, played now, against one of the league's own sides in turn, with the lineup as it is. The first few each
 * day pay coins; after that they are for fun. No league points, no Pass XP and no goal progress, so they can not be
 * farmed for more than the daily coins.
 */
export function playFriendly(ctx: FlowContext): FlowResult<{ fixture: FixtureResult }> {
  const { state, cards, players, config, clubId, now } = ctx
  const lineup = lineupForMatch(state, cards, players, config)
  if (lineup.players.every(player => player === null))
    throw new GameRuleError('no-lineup', 'Pick at least one player to play a friendly.')

  const played = state.friendlies.played
  const rivals = generateRivals(state.league.tier, config)
  const rival = rivals[played % rivals.length]
  const score = scoreLineup(lineup.formation, lineup.players, lineup.bonus ?? 0)
  const outcome = playMatch({
    formation: lineup.formation,
    att: score.att,
    def: score.def,
    slots: score.slots.map(slot => ({ role: slot.role, score: slot.score })),
    opponent: { formation: rival.formation, att: rival.att, def: rival.def, roles: rival.roles },
    seed: hashSeed(clubId, 'friendly', played),
  }, config)

  const day = dayIndex(now, config)
  const pays = paidFriendliesLeft(state, config, now) > 0
  const coins = pays ? coinsFor(outcome.result, config) : 0
  const fixture: FixtureResult = {
    no: friendlyNo(played),
    formation: lineup.formation,
    squads: { ours: FORMATIONS[lineup.formation].roles.map((_, slot) => lineup.names?.[slot] ?? 'A trialist'), theirs: rival.names },
    tier: state.league.tier,
    kickoffAt: now,
    rival: { index: rival.index, name: rival.name, formation: rival.formation, rating: rival.rating, att: rival.att, def: rival.def },
    goalsFor: outcome.goalsFor,
    goalsAgainst: outcome.goalsAgainst,
    result: outcome.result,
    points: 0,
    coins,
    events: outcome.events,
    warmupBonus: 0,
    promotedTo: null,
  }

  return {
    state: {
      ...state,
      coins: state.coins + coins,
      friendlies: { played: played + 1, paid: pays ? bump(state.friendlies.paid, day) : state.friendlies.paid },
    },
    ledger: coins > 0 ? [{ currency: 'coins', amount: coins, reason: 'friendly', ref: String(fixture.no) }] : [],
    extra: { fixture },
  }
}
