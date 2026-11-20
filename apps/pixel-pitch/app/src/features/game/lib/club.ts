import type { Fielded, GameConfig, GameResponse, OwnedCard, Player, PlayerLookup, PoolPlayer, Side } from '@ld/pixel-pitch-core'
import { generateRivals, leagueLabel, lineupForMatch, scoreLineup, toFielded } from '@ld/pixel-pitch-core'

export function kitOf(game: GameResponse): readonly [string, string] {
  return [game.club.kitPrimary, game.club.kitSecondary]
}

export function leagueName(tier: number) {
  const label = leagueLabel(tier)
  return label.kind === 'league' ? `League ${label.league}` : `Prestige ${label.level}`
}

/** The squad as the lineup tools see it: every card with its catalogue player, rated with stars and training. */
export function squadPool(cards: readonly OwnedCard[], players: PlayerLookup, config: GameConfig): PoolPlayer[] {
  return cards.flatMap((card) => {
    const player = players(card.playerId)
    return player ? [{ id: card.id, ...toFielded(card, player, config) }] : []
  })
}

export function currentScore(game: GameResponse, players: PlayerLookup, config: GameConfig) {
  const lineup = lineupForMatch(game.club.state, game.cards, players, config)
  return scoreLineup(lineup.formation, lineup.players, lineup.bonus)
}

/** The rival in the next match: the league plays the five rivals in turn. */
export function nextRival(game: GameResponse, config: GameConfig) {
  const { tier, fixtureNo } = game.club.state.league
  const rivals = generateRivals(tier, config)
  return rivals[fixtureNo % rivals.length]
}

export function rivalSide(rival: ReturnType<typeof nextRival>): Side {
  return { formation: rival.formation, att: rival.att, def: rival.def }
}

export interface SquadCard {
  card: OwnedCard
  player: Player
  fielded: Fielded
}

export function squadCards(game: GameResponse, players: PlayerLookup, config: GameConfig): SquadCard[] {
  return game.cards.flatMap((card) => {
    const player = players(card.playerId)
    return player ? [{ card, player, fielded: toFielded(card, player, config) }] : []
  })
}

/** How far the device clock is from the server's. Countdowns add it to Date.now(). */
export function serverOffset(game: GameResponse, receivedAt: number) {
  return game.now - receivedAt
}
