import type { GameConfig } from './config'
import type { Fielded } from './lineup'
import type { Player } from './catalogue'
import { GameRuleError } from './errors'

/** A player one person owns. `stars` grows by merging copies, `trained` by spending coins. */
export interface OwnedCard {
  id: string
  playerId: string
  stars: number
  trained: number
}

export const MAX_RATING = 99

/** Rating a card plays with: the player's base, +6 for every star above the first, +1 for every training. */
export function cardRating(card: OwnedCard, player: Player, config: GameConfig): number {
  return Math.min(MAX_RATING, player.rating + (card.stars - 1) * config.cards.mergeBonus + card.trained)
}

export function toFielded(card: OwnedCard, player: Player, config: GameConfig): Fielded {
  return { position: player.position, altPosition: player.altPosition, nation: player.nation, rating: cardRating(card, player, config) }
}

/** What selling returns. A merged card is worth the cards that went into it. */
export function sellValue(card: OwnedCard, player: Player, config: GameConfig): number {
  return config.cards.sellValue[player.rarity] * config.cards.mergeCopies ** (card.stars - 1)
}

/** Coins for the card's next +1 rating, or why it cannot be trained. Each training costs more than the last. */
export function trainingCost(card: OwnedCard, player: Player, config: GameConfig): { cost: number } | { blocked: 'maxed' } {
  if (card.trained >= config.cards.trainingCap[player.rarity])
    return { blocked: 'maxed' }
  return { cost: config.cards.trainingCost[player.rarity] * (card.trained + 1) }
}

export function train(card: OwnedCard, player: Player, config: GameConfig): { card: OwnedCard, cost: number } {
  const next = trainingCost(card, player, config)
  if ('blocked' in next)
    throw new GameRuleError('maxed', 'This card is fully trained.')
  return { card: { ...card, trained: card.trained + 1 }, cost: next.cost }
}

/** Groups of cards that can be merged right now: enough copies of one player at the same star level, below the top. */
export function mergeable(cards: readonly OwnedCard[], config: GameConfig): OwnedCard[][] {
  const groups = new Map<string, OwnedCard[]>()
  for (const card of cards) {
    if (card.stars >= config.cards.maxStars)
      continue
    const key = `${card.playerId}:${card.stars}`
    groups.set(key, [...(groups.get(key) ?? []), card])
  }
  return [...groups.values()].filter(group => group.length >= config.cards.mergeCopies)
}

/**
 * Merges the named cards into one card a star higher, keeping the best training among them so nothing already paid
 * for is lost. The ids must be exactly the right number of copies of one player at one star level.
 */
export function mergeCards(cards: readonly OwnedCard[], ids: readonly string[], newId: string, config: GameConfig): { cards: OwnedCard[], merged: OwnedCard } {
  if (ids.length !== config.cards.mergeCopies || new Set(ids).size !== ids.length)
    throw new GameRuleError('merge-count', `Merging needs exactly ${config.cards.mergeCopies} different cards.`)

  const chosen = ids.map((id) => {
    const card = cards.find(entry => entry.id === id)
    if (!card)
      throw new GameRuleError('not-owned', 'One of those cards is not in your squad.')
    return card
  })
  const [first] = chosen
  if (chosen.some(card => card.playerId !== first.playerId || card.stars !== first.stars))
    throw new GameRuleError('merge-mismatch', 'Merge copies of the same player at the same star level.')
  if (first.stars >= config.cards.maxStars)
    throw new GameRuleError('max-stars', 'This player is already at the top star level.')

  const merged: OwnedCard = { id: newId, playerId: first.playerId, stars: first.stars + 1, trained: Math.max(...chosen.map(card => card.trained)) }
  return { cards: [...cards.filter(card => !ids.includes(card.id)), merged], merged }
}

/** Cards that are not in the lineup count against the bench limit. */
export function benchCount(cards: readonly OwnedCard[], lineupIds: ReadonlyArray<string | null>): number {
  const inLineup = new Set(lineupIds.filter((id): id is string => id !== null))
  return cards.filter(card => !inLineup.has(card.id)).length
}

export function benchHasRoom(cards: readonly OwnedCard[], lineupIds: ReadonlyArray<string | null>, config: GameConfig, incoming = 1): boolean {
  return benchCount(cards, lineupIds) + incoming <= config.cards.benchSize
}
