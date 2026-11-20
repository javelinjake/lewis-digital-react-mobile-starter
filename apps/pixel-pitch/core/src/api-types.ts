import type { ClubState } from './club'
import type { OwnedCard } from './cards'
import type { FixtureResult } from './league'
import type { WelcomeBackEvent } from './state'

/**
 * What the game api answers with. Declared here, beside the rules, so the api and the app share one definition
 * (the app may not import the api package's code).
 */
export interface ClubView {
  id: number
  name: string
  crest: number
  kitPrimary: string
  kitSecondary: string
  state: ClubState
  version: number
}

export interface GameResponse {
  club: ClubView
  cards: OwnedCard[]
  /** Matches played by this request, oldest first. */
  fixtures: FixtureResult[]
  events: WelcomeBackEvent[]
  /** The server's time for this answer, so countdowns start from the server clock. */
  now: number
  configVersion: number
}

/** Onboarding choices. */
export interface NewClub {
  name: string
  crest: number
  kitPrimary: string
  kitSecondary: string
}

/** Crests are a base shape (4) with an emblem (8). */
export const CREST_BASES = ['shield', 'round', 'square', 'pennant'] as const
export const CREST_EMBLEMS = ['ball', 'bolt', 'crown', 'flame', 'star', 'tree', 'wave', 'wings'] as const
export const CREST_COUNT = CREST_BASES.length * CREST_EMBLEMS.length

export function crestParts(crest: number) {
  return { base: CREST_BASES[Math.floor(crest / CREST_EMBLEMS.length) % CREST_BASES.length], emblem: CREST_EMBLEMS[crest % CREST_EMBLEMS.length] }
}
