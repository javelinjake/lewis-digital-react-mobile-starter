import type { ClubState, DailyGoal } from '../src'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, medalTargets, newClubState, recordMastery } from '../src'

const config = DEFAULT_CONFIG
const T0 = Date.UTC(2026, 10, 12, 12)

const withGoal = (kind: DailyGoal['kind']): ClubState => ({ ...newClubState(T0, config), daily: { day: 1, freePackClaimed: false, goals: [{ id: 'g', kind, target: 2, progress: 0, claimed: false }] } })

describe('the new daily goals and Pass XP', () => {
  it('are in the goal pool', () => {
    expect(config.daily.goals.map(goal => goal.kind)).toEqual(expect.arrayContaining(['playChances', 'playChallenge', 'earnMedals']))
  })

  it('count each medal earned towards the medal goal, with 5 Pass XP each', () => {
    const [, silver] = medalTargets('kick', config)
    const result = recordMastery(withGoal('earnMedals'), 'kick', 1, silver, config)
    expect(result.medals).toHaveLength(2)
    expect(result.state.daily.goals[0].progress).toBe(2)
    expect(result.state.pass.xp).toBe(2 * config.pass.xp.medal)
  })
})
