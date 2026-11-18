import type { CarSnapshot } from '@/game/persistence/types'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResultsScreen } from '@/features/results/components/ResultsScreen'
import { buildResultsViewModel, observe } from '@/features/results/lib/results-model'
import { bestPerChallenge } from '@/features/results/lib/tests-tab'
import { sequentialContext } from '@/game/build/doc'
import { swapWheelGroup } from '@/game/build/edit'
import { buildStarter } from '@/game/catalog/starters'
import { getChallenge } from '@/game/challenges'
import { freshRepo, outcomeOf, runRecord } from './screens-helpers'

vi.mock('@/components/viewport/CarViewport', () => ({ CarViewport: () => null }))
vi.mock('@/render', () => ({ renderCarThumbnail: async () => null, fallbackThumbnail: () => 'data:image/svg+xml;utf8,x' }))

const mud = getChallenge('garden_mud')!

describe('results view-model', () => {
  it('shows a personal best with the previous time and a directionally correct phrase (AC23)', () => {
    const previous = runRecord({ metrics: { time: 23.1 } })
    const run = runRecord({ metrics: { time: 21.8 }, wasBest: true, completion: 'great' })
    const vm = buildResultsViewModel({ run, def: mud, previous })
    expect(vm.title).toBe('MUD RUN COMPLETE')
    expect(vm.finished).toBe(true)
    expect(vm.primary).toEqual({ label: 'Time', value: '00:21.8' })
    expect(vm.badge.kind).toBe('best')
    expect(vm.alsoGreat).toBe(true)
    expect(vm.previous).toEqual({ value: '00:23.1', phrase: '1.3 seconds quicker', direction: 'better' })
    expect(vm.replay).toEqual({ available: false, label: 'Replay unavailable' })
  })

  it('reports a slower run as slower, and a great run that is not a best as Great run', () => {
    const previous = runRecord({ metrics: { time: 21.8 } })
    const run = runRecord({ metrics: { time: 23.3 }, completion: 'great' })
    const vm = buildResultsViewModel({ run, def: mud, previous })
    expect(vm.badge.kind).toBe('great')
    expect(vm.previous!.direction).toBe('worse')
    expect(vm.previous!.phrase).toBe('1.5 seconds slower')
    expect(vm.suggestion).toBeNull()
  })

  it('treats a run that used reset as a practice run with the reason', () => {
    const run = runRecord({ eligible: false, invalidReasons: ['Reset used'], metrics: { time: 20 } })
    const vm = buildResultsViewModel({ run, def: mud, previous: null })
    expect(vm.badge).toMatchObject({ kind: 'practice', text: 'Practice run', detail: 'Reset used' })
    expect(vm.finished).toBe(true)
    expect(vm.previous).toBeNull()
  })

  it('never shows a finish time for an incomplete run, and keeps useful progress honest', () => {
    const run = runRecord({ status: 'ended', endReason: 'timeout', metrics: {}, progress: 0.63, completion: null, eligible: false })
    const vm = buildResultsViewModel({ run, def: mud, previous: null })
    expect(vm.title).toBe('TRY AGAIN')
    expect(vm.finished).toBe(false)
    expect(vm.badge.kind).toBe('tryagain')
    expect(vm.primary).toEqual({ label: 'Progress', value: '63%' })
    expect(vm.progressText).toBe('Furthest: 63%')
    expect(JSON.stringify(vm)).not.toMatch(/\d\d:\d\d\.\d/)

    const fell = runRecord({ status: 'ended', endReason: 'out_of_bounds', metrics: {}, progress: 0, completion: null })
    expect(buildResultsViewModel({ run: fell, def: mud, previous: null }).title).toBe('RUN ENDED')
    expect(buildResultsViewModel({ run: fell, def: mud, previous: null }).primary).toBeNull()
  })

  it('keeps a partial drift score visible on an ended run', () => {
    const run = runRecord({ challengeId: 'kitchen_drift', status: 'ended', endReason: 'failed', metrics: { driftScore: 12.4 }, completion: null, progress: 0 })
    const vm = buildResultsViewModel({ run, def: getChallenge('kitchen_drift')!, previous: null })
    expect(vm.primary).toEqual({ label: 'Drift score so far', value: '12' })
  })

  it('does not compare runs whose settings differ', () => {
    const previous = runRecord({ assist: 'off', metrics: { time: 30 } })
    const vm = buildResultsViewModel({ run: runRecord(), def: mud, previous })
    expect(vm.previous).toBeNull()
  })

  it('describes build changes as observations, not causes', () => {
    const c = sequentialContext('b')
    const before = buildStarter('racer', c)
    const front = before.wheelGroups.find(g => g.steering)!
    const result = swapWheelGroup(before, front.id, 'wheel_offroad', c)
    if (!result.ok)
      throw new Error('swap')
    const snap = (doc: typeof before, id: string): CarSnapshot => ({ id, carId: doc.carId, revisionId: doc.revisionId, createdAt: '', doc })
    const vm = buildResultsViewModel({
      run: runRecord({ carSnapshotId: 'b' }),
      def: mud,
      previous: runRecord({ metrics: { time: 23.1 }, carSnapshotId: 'a' }),
      snapshots: { current: snap(result.doc, 'b'), previous: snap(before, 'a') },
    })
    expect(vm.observations).toContain('This car has larger wheels')
    expect(vm.observations.join(' ')).not.toMatch(/because|caused|made it/i)
    expect(observe('Heavier')).toBe('This car is heavier')
  })
})

describe('tests tab', () => {
  it('lists the best eligible result per challenge and "not tested yet" otherwise', () => {
    const rows = bestPerChallenge([
      runRecord({ metrics: { time: 22 } }),
      runRecord({ metrics: { time: 20 }, completion: 'great' }),
      runRecord({ metrics: { time: 10 }, eligible: false }),
      runRecord({ challengeId: 'kitchen_braking', metrics: { stoppingDistance: 0.8 } }),
    ])
    expect(rows).toHaveLength(8)
    expect(rows.find(r => r.def.id === 'garden_mud')).toMatchObject({ best: 20, great: true })
    expect(rows.find(r => r.def.id === 'kitchen_braking')!.best).toBe(0.8)
    expect(rows.find(r => r.def.id === 'garden_jump')!.best).toBeNull()
  })
})

describe('results screen', () => {
  afterEach(cleanup)

  const renderAt = (runId: string) => {
    const router = createMemoryRouter([{ path: '/results/:runId', Component: ResultsScreen }], { initialEntries: [`/results/${runId}`] })
    return render(<RouterProvider router={router} />)
  }

  it('shows the badge, the big time and a disabled Replay unavailable button', async () => {
    const { repo } = freshRepo()
    const c = sequentialContext('s')
    const doc = buildStarter('racer', c)
    await repo.saveCar(doc)
    const snapshotId = await repo.saveSnapshot(doc)
    const first = runRecord({ carId: doc.carId, carSnapshotId: snapshotId, metrics: { time: 23.1 } })
    await repo.commitRun(first, mud, outcomeOf(first), null)
    const second = runRecord({ carId: doc.carId, carSnapshotId: snapshotId, metrics: { time: 21.8 }, completion: 'great' })
    await repo.commitRun(second, mud, outcomeOf(second), null)

    renderAt(second.id)
    await waitFor(() => expect(screen.getByTestId('result-value').textContent).toBe('00:21.8'))
    expect(screen.getByTestId('result-badge').textContent).toBe('Personal best')
    expect(screen.getByTestId('result-previous').textContent).toContain('00:23.1')
    expect(screen.getByTestId('result-delta').textContent).toBe('1.3 seconds quicker')
    const replay = screen.getByRole('button', { name: 'Replay unavailable' }) as HTMLButtonElement
    expect(replay.disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Drive again/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows a friendly empty state for a missing run', async () => {
    freshRepo()
    renderAt('nope')
    await waitFor(() => expect(screen.getByText(/could not find that result/i)).toBeTruthy())
  })
})
