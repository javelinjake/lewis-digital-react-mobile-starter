import type { AnyTaps, ClubState, FixtureResult, FlowContext, GameConfig, OwnedCard } from '../src'
import type { Profile } from './pacing'
import { finishChance, perfectTaps, playConfig, skipChance, startChance } from '../src'

interface Sim {
  state: ClubState
  cards: OwnedCard[]
  nextId: number
}

/**
 * What a profile's skill does after each catch-up: every Big Chance (and a live moment, when the visit caught one) is
 * scored `skill` of the time and let go otherwise. A scored one is played perfectly, a miss is let go: the same to
 * the rules.
 */
export function pacingHooks(_config: GameConfig) {
  return {
    afterSync: (sim: Sim, _fixtures: FixtureResult[], profile: Profile, rng: { next: () => number }, ctx: () => FlowContext): Sim => {
      if (profile.skill <= 0)
        return sim
      let current = sim
      const waiting = [...current.state.chances, ...(current.state.live ? [current.state.live] : [])]
      for (const chance of waiting) {
        const at = { ...ctx(), state: current.state }
        if (rng.next() >= profile.skill) {
          current = { ...current, state: skipChance(at, chance.fixtureNo).state }
          continue
        }
        const started = startChance(at, chance.fixtureNo).state
        const ticket = started.ticket!
        const taps = perfectTaps(ticket.cabinet!, ticket.seed, playConfig(at.config, ticket)) as AnyTaps
        current = { ...current, state: finishChance({ ...at, state: started, now: at.now + 60_000 }, taps).state }
      }
      return current
    },
  }
}
