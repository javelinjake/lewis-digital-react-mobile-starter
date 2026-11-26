import type { ClubState, FixtureResult, FlowContext, GameConfig, OwnedCard } from '../src'
import type { Profile } from './pacing'

interface Sim {
  state: ClubState
  cards: OwnedCard[]
  nextId: number
}

/** What a profile's skill does after each catch-up. Big Chances plug in here. */
export function pacingHooks(_config: GameConfig) {
  return {
    afterSync: (sim: Sim, _fixtures: FixtureResult[], _profile: Profile, _rng: { next: () => number }, _ctx: () => FlowContext): Sim => sim,
  }
}
