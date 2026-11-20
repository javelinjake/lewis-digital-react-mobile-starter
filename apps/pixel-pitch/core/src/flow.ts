import type { OwnedCard } from './cards'
import type { Player } from './catalogue'
import type { ClubState, PlayerLookup } from './club'
import type { GameConfig } from './config'

export interface LedgerEntry {
  currency: 'coins' | 'gems' | 'tokens'
  /** Positive for a gain, negative for a spend. */
  amount: number
  reason: string
  ref?: string
}

export type CardSource = 'starter' | 'pack' | 'merge' | 'arcade'

/** What a game action needs to know. The api builds it from the database, the mock from the browser's copy. */
export interface FlowContext {
  state: ClubState
  cards: readonly OwnedCard[]
  catalogue: readonly Player[]
  players: PlayerLookup
  config: GameConfig
  clubId: string | number
  now: number
}

/** What a game action decided. The api writes it in one transaction; the mock keeps it in the browser. */
export interface FlowResult<T = undefined> {
  state: ClubState
  /** The squad afterwards, if it changed. Ids starting with `NEW_CARD_PREFIX` are new cards. */
  cards?: OwnedCard[]
  /** Where new cards came from. */
  source?: CardSource
  ledger?: LedgerEntry[]
  /** Extra information for the answer (a mini-game's score, what a claim paid). */
  extra?: T
}
