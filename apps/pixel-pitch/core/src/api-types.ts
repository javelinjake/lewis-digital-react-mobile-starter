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

/** The eight kits every club can wear for free (chosen at onboarding). Premium kits are in `config.cosmetics.kits`. */
export const BASE_KITS: ReadonlyArray<{ id: string, name: string, primary: string, secondary: string }> = [
  { id: 'base-red', name: 'Red and white', primary: '#e2483d', secondary: '#f4f4f4' },
  { id: 'base-blue', name: 'Blue and white', primary: '#3f7fd6', secondary: '#f4f4f4' },
  { id: 'base-yellow', name: 'Yellow and navy', primary: '#ffd23f', secondary: '#1b1f3b' },
  { id: 'base-green', name: 'Green and white', primary: '#3fa34d', secondary: '#f4f4f4' },
  { id: 'base-black', name: 'Black and yellow', primary: '#10122a', secondary: '#ffd23f' },
  { id: 'base-pink', name: 'Pink and navy', primary: '#ff4f79', secondary: '#1b1f3b' },
  { id: 'base-orange', name: 'Orange and black', primary: '#ff9f43', secondary: '#10122a' },
  { id: 'base-sky', name: 'Sky and navy', primary: '#5ec8ff', secondary: '#1b1f3b' },
]

/** A change to the club's look: a kit (base or owned premium) and/or a crest. */
export interface IdentityChange {
  kitId?: string
  crest?: number
}

/** The club's look after a change, for the api to store beside the state. */
export interface ClubIdentity {
  crest: number
  kitPrimary: string
  kitSecondary: string
}
