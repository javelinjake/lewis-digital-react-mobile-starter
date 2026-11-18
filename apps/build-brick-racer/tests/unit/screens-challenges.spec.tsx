import type { ChallengeDefinition } from '@/game/challenges/types'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ChallengeCard } from '@/features/challenges/components/ChallengeCard'
import { awardOf, currentSignature, formatPrimary, progressFor } from '@/features/challenges/lib/best'
import { powerLabel, readyState } from '@/features/challenges/lib/ready-model'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { buildStarter } from '@/game/catalog/starters'
import { getChallenge } from '@/game/challenges'
import { assessDrive } from '@/game/vehicle/analysis'
import { freshRepo, outcomeOf, runRecord } from './screens-helpers'

describe('challenge cards (AC23)', () => {
  const def = getChallenge('garden_mud')!
  beforeEach(() => {
    freshRepo()
  })
  afterEach(cleanup)

  it('looks up the personal best by the CURRENT settings signature', async () => {
    const { repo } = freshRepo()
    const light = runRecord({ metrics: { time: 21.8 }, completion: 'great' })
    await repo.commitRun(light, def, outcomeOf(light), null)
    const off = runRecord({ assist: 'off', signature: currentSignature(def, 'off'), metrics: { time: 18.2 } })
    await repo.commitRun(off, def, outcomeOf(off), null)

    const all = await repo.listProgress()
    expect(all).toHaveLength(2)
    expect(progressFor(def, 'light', all)!.bestValue).toBe(21.8)
    expect(progressFor(def, 'off', all)!.bestValue).toBe(18.2)
    expect(progressFor(getChallenge('garden_climb')!, 'light', all)).toBeUndefined()
    expect(awardOf(progressFor(def, 'light', all))).toBe('great')
    expect(awardOf(progressFor(def, 'off', all))).toBe('finished')
    expect(awardOf(undefined)).toBe('none')
  })

  it('formats times like 00:21.8 and other metrics with their units', () => {
    expect(formatPrimary(def, 21.8)).toBe('00:21.8')
    expect(formatPrimary(def, 83.04)).toBe('01:23.0')
    expect(formatPrimary(def, null)).toBe('Not measured')
    expect(formatPrimary(getChallenge('kitchen_braking')!, 0.66)).toBe('0.66 m')
    expect(formatPrimary(getChallenge('kitchen_drift')!, 19.3)).toBe('19')
  })

  it('shows the tagline, the best time and the award on the card, and is always selectable', async () => {
    const { repo } = freshRepo()
    const run = runRecord({ metrics: { time: 21.8 }, completion: 'great' })
    await repo.commitRun(run, def, outcomeOf(run), null)
    const progress = await repo.listProgress()
    let picked = 0
    render(<ChallengeCard def={def} selected assist="light" progress={progress} onSelect={() => picked++} />)
    const card = screen.getByRole('radio')
    expect(card.textContent).toContain('Cross the mud')
    expect(card.textContent).toContain('00:21.8')
    expect(card.textContent).toContain('Great')
    expect(card.getAttribute('aria-checked')).toBe('true')
    card.click()
    expect(picked).toBe(1)
  })

  it('a challenge with no awards is still selectable and shows no best', () => {
    let picked = 0
    render(<ChallengeCard def={getChallenge('garden_jump')!} selected={false} assist="light" progress={[]} onSelect={() => picked++} />)
    const card = screen.getByRole('radio')
    expect(card.textContent).not.toContain('Best')
    card.click()
    expect(picked).toBe(1)
  })
})

describe('ready screen state', () => {
  it('names the limitation when the car does not fit the start area and offers free drive', () => {
    const doc = buildStarter('racer', sequentialContext('r'))
    const assessment = assessDrive(doc)
    const tiny: ChallengeDefinition = { ...getChallenge('kitchen_sprint')!, spawnClearance: { centre: [0, 1, 0], half: [0.1, 1, 0.1], yaw: 0 } }
    const state = readyState(tiny, assessment)
    expect(state.kind).toBe('too_big')
    if (state.kind === 'too_big')
      expect(state.reason).toMatch(/too big/i)
    // Free drive always has open ground.
    expect(readyState(null, assessment).kind).toBe('ok')
    expect(readyState(getChallenge('kitchen_sprint')!, assessment).kind).toBe('ok')
  })

  it('blocks with the cause for a car that cannot be simulated', () => {
    const empty = assessDrive(createEmptyDoc(sequentialContext('e')))
    const state = readyState(getChallenge('kitchen_sprint')!, empty)
    expect(state.kind).toBe('blocked')
  })

  it('shows power mode read-only', () => {
    expect(powerLabel(getChallenge('kitchen_sprint')!)).toBe('Gravity — motor off')
    expect(powerLabel(getChallenge('garden_mud')!)).toBe('Motor on')
    expect(powerLabel(null)).toBe('Motor on')
  })
})
