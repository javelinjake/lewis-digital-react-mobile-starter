import type { FixtureResult } from '@ld/pixel-pitch-core'
import { FORMATIONS } from '@ld/pixel-pitch-core'

/** Matches saved before squads were recorded have none: give them plain names so a report can still be written. */
export function reportable(fixture: FixtureResult): FixtureResult {
  if (fixture.squads && fixture.formation)
    return fixture
  const named = (roles: readonly string[], prefix: string) => roles.map((role, index) => `${prefix} ${role.toLowerCase()} ${index + 1}`)
  return {
    ...fixture,
    formation: fixture.formation ?? '2-2',
    squads: fixture.squads ?? { ours: named(FORMATIONS[fixture.formation ?? '2-2'].roles, 'Our'), theirs: named(FORMATIONS[fixture.rival.formation].roles, 'Their') },
  }
}

const surname = (name: string) => name.split(' ').at(-1) ?? name

/** Who scored, in order, from the match's goal events and the names of the two sides that day. */
export function scorersOf(fixture: FixtureResult) {
  const { squads } = reportable(fixture)
  return fixture.events
    .filter(event => event.kind === 'goal')
    .sort((a, b) => a.minute - b.minute)
    .map(event => ({
      minute: event.minute,
      side: event.side,
      name: surname((event.side === 'for' ? squads.ours : squads.theirs)[event.slot] ?? ''),
    }))
}
