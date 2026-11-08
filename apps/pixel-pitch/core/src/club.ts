import type { OwnedCard } from './cards'
import type { Player } from './catalogue'
import type { GameConfig } from './config'
import type { FixtureResult, LeagueState, LineupForMatch } from './league'
import type { Fielded } from './lineup'
import type { FormationId } from './positions'
import type { IdleState, WelcomeBackEvent } from './state'
import { hashSeed } from '@ld/utils/random/rng'
import { advance, notificationTimes } from './advance'
import { mergeCards, sellValue, toFielded, train, trainingCost } from './cards'
import { GameRuleError } from './errors'
import { generateRivals, newLeagueState, playDueFixtures } from './league'
import { scoreLineup, SLOT_COUNT } from './lineup'
import { playMatch } from './match'
import { isFormationId } from './positions'
import { newIdleState } from './state'

/** Everything about a club that changes with time or with the player's choices, apart from the cards themselves. */
export interface ClubState {
  idle: IdleState
  league: LeagueState
  formation: FormationId
  /** Card id in each of the five slots, `null` for an empty slot. */
  lineup: Array<string | null>
  /** Players opened since the last Star or better, for the pack guarantee. */
  pity: number
  coins: number
  tokens: number
}

export function newClubState(now: number, config: GameConfig): ClubState {
  return {
    idle: newIdleState(now),
    league: newLeagueState(now, config),
    formation: '2-2',
    lineup: Array.from({ length: SLOT_COUNT }, () => null),
    pity: 0,
    coins: 0,
    tokens: 0,
  }
}

/** Looks up a catalogue player by id. The api passes the `players` collection, the app its cached copy. */
export type PlayerLookup = (playerId: string) => Player | undefined

/** The lineup as the match engine sees it. A slot whose card is gone (sold, merged) plays empty. */
export function lineupForMatch(state: Pick<ClubState, 'formation' | 'lineup'>, cards: readonly OwnedCard[], players: PlayerLookup, config: GameConfig): LineupForMatch {
  const byId = new Map(cards.map(card => [card.id, card]))
  const fielded = state.lineup.map((cardId): Fielded | null => {
    const card = cardId ? byId.get(cardId) : undefined
    const player = card ? players(card.playerId) : undefined
    return card && player ? toFielded(card, player, config) : null
  })
  return { formation: state.formation, players: fielded }
}

export interface SyncResult {
  state: ClubState
  /** For the welcome-back summary. Empty when nothing happened. */
  events: WelcomeBackEvent[]
  /** Matches played in this catch-up, oldest first. The api stores them; the app replays the last. */
  fixtures: FixtureResult[]
}

/**
 * Brings a club up to `now`: fills the pack shelf, grants the day's gems and plays every league match that fell due,
 * paying their coins. Pure, and the same whether it runs every five minutes or once a day (below the catch-up limit),
 * which the tests check. Every api call runs this first, so every action sees an up-to-date club.
 */
export function syncClub(input: { state: ClubState, cards: readonly OwnedCard[], players: PlayerLookup, clubId: string | number, config: GameConfig, now: number }): SyncResult {
  const { state, cards, players, clubId, config, now } = input
  const idle = advance(state.idle, config, now)
  const league = playDueFixtures({ league: state.league, lineup: lineupForMatch(state, cards, players, config), clubId, config, now })

  const events = [...idle.events]
  if (league.results.length > 0 || league.skipped > 0) {
    const count = (result: FixtureResult['result']) => league.results.filter(match => match.result === result).length
    const promotions = league.results.map(match => match.promotedTo).filter((tier): tier is number => tier !== null)
    events.push({
      type: 'matches',
      played: league.results.length,
      won: count('win'),
      drawn: count('draw'),
      lost: count('loss'),
      coins: league.coins,
      skipped: league.skipped,
      promotedTo: promotions.length > 0 ? Math.max(...promotions) : null,
    })
  }

  return {
    state: { ...state, idle: idle.state, league: league.league, coins: state.coins + league.coins },
    events,
    fixtures: league.results,
  }
}

/**
 * Sets the formation and who plays where. Every id must be one of the player's own cards, once. Empty slots are
 * allowed (a new club has fewer than five players), and so is a lineup with no goalkeeper: it just plays badly.
 */
export function setLineup(state: ClubState, formation: string, lineup: ReadonlyArray<string | null>, cards: readonly OwnedCard[]): ClubState {
  if (!isFormationId(formation))
    throw new GameRuleError('formation', 'That formation does not exist.')
  if (lineup.length !== SLOT_COUNT)
    throw new GameRuleError('lineup-size', `A lineup has ${SLOT_COUNT} slots.`)
  const owned = new Set(cards.map(card => card.id))
  const chosen = lineup.filter((id): id is string => id !== null)
  if (chosen.some(id => !owned.has(id)))
    throw new GameRuleError('not-owned', 'One of those players is not in your squad.')
  if (new Set(chosen).size !== chosen.length)
    throw new GameRuleError('duplicate', 'A player can only fill one slot.')
  return { ...state, formation, lineup: [...lineup] }
}

/** Every alert time for the club: the idle timers and the next kick-off ("full time" fires when it has been played). */
export function clubNotificationTimes(state: ClubState, config: GameConfig, now: number) {
  return { ...notificationTimes(state.idle, config, now), nextKickoffAt: state.league.nextKickoffAt }
}

/** A card the rules have just made. The api replaces `id` with the database id once it is stored. */
export const NEW_CARD_PREFIX = 'new:'

export interface CardChange {
  state: ClubState
  /** The squad after the change. Ids starting with `NEW_CARD_PREFIX` are new cards. */
  cards: OwnedCard[]
  /** Coins gained (selling) or spent (training, as a negative number). */
  coins: number
}

function findCard(cards: readonly OwnedCard[], cardId: string) {
  const card = cards.find(entry => entry.id === cardId)
  if (!card)
    throw new GameRuleError('not-owned', 'That player is not in your squad.')
  return card
}

function playerOf(card: OwnedCard, players: PlayerLookup) {
  const player = players(card.playerId)
  if (!player)
    throw new Error(`Card ${card.id} refers to ${card.playerId}, which is not in the catalogue.`)
  return player
}

/** Sells a bench card for coins. A player in the lineup must be taken out first. */
export function sellCard(state: ClubState, cards: readonly OwnedCard[], cardId: string, players: PlayerLookup, config: GameConfig): CardChange {
  const card = findCard(cards, cardId)
  if (state.lineup.includes(cardId))
    throw new GameRuleError('in-lineup', 'Take this player out of the lineup before selling.')
  const coins = sellValue(card, playerOf(card, players), config)
  return { state: { ...state, coins: state.coins + coins }, cards: cards.filter(entry => entry.id !== cardId), coins }
}

/** Merges copies into one card a star higher. If one of them was in the lineup, the merged card takes its place. */
export function mergeInClub(state: ClubState, cards: readonly OwnedCard[], cardIds: readonly string[], config: GameConfig): CardChange & { merged: OwnedCard } {
  const result = mergeCards(cards, cardIds, `${NEW_CARD_PREFIX}merged`, config)
  const lineup = state.lineup.map(id => (id !== null && cardIds.includes(id) ? null : id))
  const slot = state.lineup.findIndex(id => id !== null && cardIds.includes(id))
  if (slot >= 0)
    lineup[slot] = result.merged.id
  return { state: { ...state, lineup }, cards: result.cards, coins: 0, merged: result.merged }
}

/** Spends coins on +1 rating. */
export function trainInClub(state: ClubState, cards: readonly OwnedCard[], cardId: string, players: PlayerLookup, config: GameConfig): CardChange {
  const card = findCard(cards, cardId)
  const next = trainingCost(card, playerOf(card, players), config)
  if ('blocked' in next)
    throw new GameRuleError('maxed', 'This card is fully trained.')
  if (state.coins < next.cost)
    throw new GameRuleError('coins', `Training costs ${next.cost} coins.`)
  const trained = train(card, playerOf(card, players), config)
  return {
    state: { ...state, coins: state.coins - trained.cost },
    cards: cards.map(entry => (entry.id === cardId ? trained.card : entry)),
    coins: -trained.cost,
  }
}

/**
 * The scripted first win from onboarding: a friendly against the weakest League 5 side, outside the league table.
 * Seeds are tried in order until the club wins, so the result is fixed for a club but still a real simulated match.
 */
export function playDebut(input: { state: ClubState, cards: readonly OwnedCard[], players: PlayerLookup, clubId: string | number, config: GameConfig, now: number }): { state: ClubState, fixture: FixtureResult } {
  const { state, cards, players, clubId, config, now } = input
  const lineup = lineupForMatch(state, cards, players, config)
  const score = scoreLineup(lineup.formation, lineup.players)
  const rival = generateRivals(1, config)[0]

  for (let attempt = 0; attempt < 200; attempt++) {
    const outcome = playMatch({
      formation: lineup.formation,
      att: score.att,
      def: score.def,
      slots: score.slots.map(slot => ({ role: slot.role, score: slot.score })),
      opponent: { formation: rival.formation, att: rival.att, def: rival.def, roles: rival.roles },
      seed: hashSeed(clubId, 'debut', attempt),
    }, config)
    if (outcome.result !== 'win')
      continue
    const coins = config.league.winCoins
    return {
      state: { ...state, coins: state.coins + coins },
      fixture: {
        no: -1,
        tier: 1,
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
      },
    }
  }
  throw new GameRuleError('debut', 'Field at least one player to play the first match.')
}
