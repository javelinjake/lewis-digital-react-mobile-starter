import type { ReactNode } from 'react'
import type { RunRecord } from '@/game/persistence/types'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { SceneBackdrop } from '@/components/ui/SceneBackdrop'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { compareMetric, compareRuns, describeBuildChange, formatMetric, METRIC_LABELS } from '@/game/comparison'
import { assessDrive } from '@/game/vehicle/analysis'
import { getRepo } from '@/lib/platform/repo'
import { carForEditing } from '../lib/actions'
import { assistLabel, formatPrimary } from '../lib/format'
import { bestPerChallenge } from '../lib/tests-tab'
import { useRunData } from '../lib/use-run-data'
import { useCarPicture } from '../lib/use-thumb'
import '../results.css'

type Tab = 'run' | 'car' | 'tests'

function DirectionMark({ direction }: { direction: string }) {
  if (direction === 'better') {
    return (
      <span className="inline-flex items-center gap-1">
        <Icon name="check" size={16} />
        <span className="sr-only">Improved</span>
      </span>
    )
  }
  if (direction === 'worse') {
    return (
      <span className="inline-flex items-center gap-1">
        <Icon name="close" size={16} />
        <span className="sr-only">Worse</span>
      </span>
    )
  }
  return null
}

/** RUN / CAR / TESTS: the numbers behind a result, with the car as it was in that run. */
export function DetailsScreen() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const data = useRunData(runId)
  const [tab, setTab] = useState<Tab>('run')
  const [tests, setTests] = useState<RunRecord[]>([])
  const [busy, setBusy] = useState(false)
  const snapshotDoc = data.status === 'ready' ? data.snapshot?.doc : null
  const picture = useCarPicture(snapshotDoc, 320)
  const carId = data.status === 'ready' ? data.run.carId : null

  useEffect(() => {
    if (!carId)
      return
    let cancelled = false
    void getRepo().listRuns(r => r.carId === carId).then((runs) => {
      if (!cancelled)
        setTests(runs)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [carId])

  const assessment = useMemo(() => (snapshotDoc ? assessDrive(snapshotDoc) : null), [snapshotDoc])

  const back = (
    <button type="button" className="btn br-btn br-cta !min-w-14 !min-h-14 !px-3" aria-label="Back to results" onClick={() => navigate(runId ? `/results/${runId}` : '/play')}>
      <Icon name="back" size={26} />
    </button>
  )

  if (data.status !== 'ready') {
    return (
      <div className="br-screen">
        <SceneBackdrop kind="plain" />
        <ScreenHeader title="Run details" left={back} />
        <div className="br-layer br-fill flex items-center justify-center text-center" role={data.status === 'loading' ? 'status' : undefined}>
          {data.status === 'loading' ? <span className="loading loading-spinner loading-lg text-primary" /> : <p className="br-display text-xl">We could not find that result</p>}
        </div>
      </div>
    )
  }

  const { run, def, previous, snapshot, previousSnapshot, carExists } = data
  const comparison = compareRuns(run, previous, { current: snapshot, previous: previousSnapshot })
  const ids = [def.metrics.primary, ...def.metrics.secondary.filter(m => m !== def.metrics.primary)]
  const rows = ids.map((id) => {
    const cur = id === 'progress' ? (run.metrics.progress ?? run.progress) : run.metrics[id]
    const prev = id === 'progress' ? (previous ? (previous.metrics.progress ?? previous.progress) : undefined) : previous?.metrics[id]
    const delta = comparison.compatible ? compareMetric(id, cur, prev) : null
    const primary = id === def.metrics.primary
    return {
      id,
      label: METRIC_LABELS[id],
      current: primary ? formatPrimary(def, cur) : formatMetric(id, cur),
      previous: comparison.compatible ? (primary ? formatPrimary(def, prev) : formatMetric(id, prev)) : '—',
      direction: delta?.direction ?? 'info',
    }
  })
  const resetsDelta = comparison.compatible ? compareMetric('resets', run.resets, previous?.resets) : null
  const changes = describeBuildChange(previousSnapshot, snapshot)
  const settingsLine = [comparison.compatible ? 'Same course' : def.shortName, assistLabel(run.assist)].join(' · ')
  const d = assessment?.derived
  const testRows = bestPerChallenge(tests)

  const changeCar = async () => {
    setBusy(true)
    const id = await carForEditing(run, carExists, snapshot)
    setBusy(false)
    if (id)
      navigate(`/build/${id}`)
  }

  const kv = (label: string, value: ReactNode) => (
    <tr key={label}>
      <th scope="row">{label}</th>
      <td>{value}</td>
    </tr>
  )

  return (
    <div className="br-screen">
      <SceneBackdrop kind={def.environment === 'garden' ? 'garden' : 'kitchen'} dim={0.4} />
      <ScreenHeader title="Run details" left={back} />

      <div className="br-layer flex flex-wrap items-center gap-3">
        <div className="details-carchip br-panel">
          {picture && <img src={picture} alt="" draggable={false} />}
          <span className="br-display br-shadow text-lg">{run.carName}</span>
        </div>
        <div role="tablist" aria-label="Details" className="ml-auto flex">
          {(['run', 'car', 'tests'] as const).map(t => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`br-tab !min-h-12 !px-5 ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
              {t === 'run' ? 'Run' : t === 'car' ? 'Car' : 'Tests'}
            </button>
          ))}
        </div>
      </div>

      <div className="details-grid br-layer br-fill">
        <section className="details-panel br-panel br-scroll" aria-label={`${tab} details`}>
          {tab === 'run' && (
            <>
              <table className="details-table" data-testid="run-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>This run</th>
                    <th>Previous</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <th scope="row">{r.label}</th>
                      <td className={r.direction === 'better' ? 'is-better' : r.direction === 'worse' ? 'is-worse' : ''}>
                        <span className="inline-flex items-center gap-2">
                          {r.current}
                          {' '}
                          <DirectionMark direction={r.direction} />
                        </span>
                      </td>
                      <td>{r.previous}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Resets</th>
                    <td className={resetsDelta?.direction === 'better' ? 'is-better' : resetsDelta?.direction === 'worse' ? 'is-worse' : ''}>{run.resets}</td>
                    <td>{comparison.compatible && previous ? previous.resets : '—'}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 flex items-center gap-2 text-sm font-bold">
                <Icon name="gear" size={18} />
                {' '}
                {settingsLine}
              </p>
              {!run.eligible && run.status === 'finished' && (
                <p className="mt-1 text-sm font-bold text-[var(--br-amber)]">
                  Practice run:
                  {run.invalidReasons.join(', ') || 'not counted for your best'}
                </p>
              )}
            </>
          )}

          {tab === 'car' && (
            d && assessment?.spec
              ? (
                  <table className="details-table" data-testid="car-table">
                    <tbody>
                      {kv('Pieces', d.partCount)}
                      {kv('Weight', `${d.massKg.toFixed(2)} kg`)}
                      {kv('Size (w × h × l)', d.sizeM.map(v => `${(v * 100).toFixed(0)} cm`).join(' × '))}
                      {kv('Wheels', d.wheelCount)}
                      {kv('Steadiness', `${Math.round(d.tipAngleDeg)}° before tipping`)}
                      {kv('Weight height', `${(d.centreOfMassHeightM * 100).toFixed(0)} cm above ground`)}
                      {kv('Ground clearance', `${(d.clearanceM * 100).toFixed(1)} cm`)}
                      {kv('Estimated airflow', `${(d.airflow.front * 1e4).toFixed(0)} cm² front`)}
                    </tbody>
                  </table>
                )
              : <p className="p-3 font-bold">Car details are not available for this run.</p>
          )}

          {tab === 'tests' && (
            <table className="details-table" data-testid="tests-table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Best result</th>
                </tr>
              </thead>
              <tbody>
                {testRows.map(t => (
                  <tr key={t.def.id}>
                    <th scope="row">{t.def.name}</th>
                    <td>
                      {t.best === null
                        ? <span className="opacity-70">Not tested yet</span>
                        : (
                            <span className="inline-flex items-center gap-2">
                              {formatPrimary(t.def, t.best)}
                              {' '}
                              {t.great && (
                                <span className="ch-award is-great">
                                  <Icon name="check" size={13} />
                                  {' '}
                                  Great
                                </span>
                              )}
                            </span>
                          )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="details-side br-panel" aria-label="Build">
          {picture && <img src={picture} alt={`${run.carName} in this run`} draggable={false} />}
          <div>
            <p className="br-display text-base">{changes.length ? 'Build changed' : previous ? 'Same build' : 'First run with this build'}</p>
            {changes.length > 0 && <p className="text-sm font-bold" data-testid="build-changes">{changes.join(', ')}</p>}
          </div>
        </aside>
      </div>

      <div className="br-layer flex items-center justify-between gap-3">
        <button type="button" className="btn br-btn" onClick={() => navigate(`/results/${run.id}`)}>
          <Icon name="back" />
          {' '}
          Back to results
        </button>
        <button type="button" className="btn br-cta" disabled={busy} onClick={() => void changeCar()}>
          Change car
          <Icon name="chevrons" size={28} />
        </button>
      </div>
    </div>
  )
}
