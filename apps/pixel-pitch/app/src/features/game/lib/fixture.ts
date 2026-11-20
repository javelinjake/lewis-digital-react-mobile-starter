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
