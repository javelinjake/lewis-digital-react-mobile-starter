import type { GameResponse } from '@ld/pixel-pitch-core'

export interface FirstStep {
  id: string
  label: string
  to: string
  done: boolean
}

/**
 * The first session, one step at a time: what a new player should do to see everything the game has. Each step is
 * read from the club itself, so it is done however the player got there, and the list goes away once all are done.
 */
export function firstSteps(game: GameResponse): FirstStep[] {
  const { state } = game.club
  return [
    { id: 'open-pack', label: 'Open a pack from your shelf', to: '/packs', done: state.packsOpened > 0 },
    { id: 'sign', label: 'Sign a player to your squad', to: '/packs', done: game.cards.length > 5 },
    { id: 'lineup', label: 'Check your lineup before kick-off', to: '/squad', done: state.league.fixtureNo > 0 || game.cards.length > 6 },
    { id: 'match', label: 'Play your first league match', to: '/league', done: state.league.fixtureNo > 0 },
    { id: 'arcade', label: 'Play an arcade game', to: '/arcade', done: state.ticketsIssued > 0 },
    { id: 'claim', label: 'Claim your daily rewards', to: '/goals', done: state.calendar.lastClaimDay >= 0 },
  ]
}
