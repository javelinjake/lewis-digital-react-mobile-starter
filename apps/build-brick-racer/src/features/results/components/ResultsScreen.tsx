import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { SceneBackdrop } from '@/components/ui/SceneBackdrop'
import { ScreenHeader, Stripes } from '@/components/ui/ScreenHeader'
import { CarViewport } from '@/components/viewport/CarViewport'
import { carForEditing, prepareDriveAgain } from '../lib/actions'
import { buildResultsViewModel } from '../lib/results-model'
import { useRunData } from '../lib/use-run-data'
import { useCarPicture } from '../lib/use-thumb'
import '../results.css'

/** Result of one attempt: one big number, a badge and four actions. Details are one tap away. */
export function ResultsScreen() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const data = useRunData(runId)
  const [busy, setBusy] = useState(false)
  const picture = useCarPicture(data.status === 'ready' ? data.snapshot?.doc : null)

  if (data.status !== 'ready') {
    return (
      <div className="br-screen">
        <SceneBackdrop kind="plain" />
        <ScreenHeader
          title={data.status === 'loading' ? 'Results' : 'No result here'}
          left={<button type="button" className="btn br-btn br-cta !min-w-14 !min-h-14 !px-3" aria-label="Back to challenges" onClick={() => navigate('/play')}><Icon name="back" size={26} /></button>}
        />
        <div className="br-layer br-fill flex flex-col items-center justify-center gap-3 text-center" role={data.status === 'loading' ? 'status' : undefined}>
          {data.status === 'loading'
            ? <span className="loading loading-spinner loading-lg text-primary" />
            : (
                <>
                  <p className="br-display text-xl">We could not find that result</p>
                  <p className="opacity-80">It may have been cleared from this device.</p>
                  <button type="button" className="btn br-btn br-cta" onClick={() => navigate('/')}>
                    <Icon name="garage" />
                    {' '}
                    Garage
                  </button>
                </>
              )}
        </div>
      </div>
    )
  }

  const { run, def, previous, snapshot, previousSnapshot, carExists } = data
  const vm = buildResultsViewModel({ run, def, previous, snapshots: { current: snapshot, previous: previousSnapshot } })
  const canDrive = carExists

  const driveAgain = () => {
    prepareDriveAgain(run, def)
    navigate('/drive')
  }
  const changeCar = async () => {
    setBusy(true)
    const id = await carForEditing(run, carExists, snapshot)
    setBusy(false)
    if (id)
      navigate(`/build/${id}`)
  }

  return (
    <div className="br-screen">
      <SceneBackdrop kind={def.environment === 'garden' ? 'garden' : 'kitchen'} dim={0.3} />
      <ScreenHeader
        title={vm.title}
        left={<button type="button" className="btn br-btn br-cta !min-w-14 !min-h-14 !px-3" aria-label="Back to challenges" onClick={() => navigate('/play')}><Icon name="back" size={26} /></button>}
      />

      <div className="results-grid br-layer br-fill">
        <div className="results-stage">
          <div className="results-name br-chip">
            <Stripes count={3} />
            {' '}
            <span>{run.carName}</span>
          </div>
          <CarViewport doc={snapshot?.doc ?? null} thumbnail={picture ?? undefined} className="absolute inset-0" mat={false} zoom={1.05} />
        </div>

        <section className="results-card br-panel" aria-label="Result">
          <span className={`results-mark ${vm.finished ? '' : 'is-bad'}`} aria-hidden="true">
            <Icon name={vm.finished ? 'check' : 'warn'} size={26} />
          </span>
          <span className={`results-badge is-${vm.badge.kind}`} data-testid="result-badge">{vm.badge.text}</span>
          {vm.alsoGreat && <span className="results-label">Great run too</span>}
          {vm.badge.detail && <p className="text-sm font-bold">{vm.badge.detail}</p>}

          {vm.primary
            ? (
                <>
                  <div className="results-value" data-testid="result-value">{vm.primary.value}</div>
                  <div className="results-label">{vm.primary.label}</div>
                </>
              )
            : <div className="results-value !text-3xl" data-testid="result-value">Not measured</div>}

          {vm.incompleteReason && <p className="text-sm font-bold" data-testid="result-reason">{vm.incompleteReason}</p>}
          {vm.progressText && vm.primary?.label !== 'Progress' && <p className="text-sm font-bold">{vm.progressText}</p>}

          {vm.previous && (
            <div className="results-prev" data-testid="result-previous">
              <span>Previous</span>
              <b>{vm.previous.value}</b>
            </div>
          )}
          {vm.previous?.phrase && (
            <span className={`results-delta self-center ${vm.previous.direction === 'worse' ? 'is-worse' : ''}`} data-testid="result-delta">
              {vm.previous.phrase}
            </span>
          )}

          {(vm.observations.length > 0 || vm.suggestion) && (
            <ul className="results-notes">
              {vm.observations.map(o => <li key={o}>{o}</li>)}
              {vm.suggestion && <li className="font-bold text-[var(--br-cyan-hi)]">{vm.suggestion}</li>}
            </ul>
          )}
        </section>
      </div>

      <div className="results-actions br-layer">
        <button type="button" className="btn br-cta" disabled={!canDrive} onClick={driveAgain}>
          Drive again
          {' '}
          <Icon name="chevrons" size={26} />
        </button>
        <button type="button" className="btn br-btn" disabled={busy} onClick={() => void changeCar()}>
          <Icon name="car" size={22} />
          {' '}
          Change car
        </button>
        <button
          type="button"
          className="btn br-btn"
          disabled={!vm.replay.available}
          aria-label={vm.replay.label}
          onClick={() => navigate(`/replay/${run.id}`)}
        >
          <Icon name="play" size={22} />
          {' '}
          {vm.replay.available ? 'Watch replay' : 'Replay unavailable'}
        </button>
        <button type="button" className="btn br-btn" onClick={() => navigate(`/results/${run.id}/details`)}>
          <Icon name="list" size={22} />
          {' '}
          Details
        </button>
      </div>
    </div>
  )
}
