import type { CameraChoice } from '@/game/persistence/types'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLaunchCheck } from '@/components/launch/use-launch-check'
import { Icon } from '@/components/ui/Icon'
import { SceneBackdrop } from '@/components/ui/SceneBackdrop'
import { ScreenHeader, Stripes } from '@/components/ui/ScreenHeader'
import { CarViewport } from '@/components/viewport/CarViewport'
import { useCarDoc } from '@/components/viewport/use-car-doc'
import { getChallenge } from '@/game/challenges'
import { assessDrive } from '@/game/vehicle/analysis'
import { useGarageStore } from '@/stores/garage.store'
import { usePrefsStore } from '@/stores/prefs.store'
import { useSessionStore } from '@/stores/session.store'
import { powerLabel, readyState } from '../lib/ready-model'
import { CarPickerSheet } from './CarPickerSheet'
import '../challenges.css'

const CAMERAS: Array<{ id: CameraChoice, label: string }> = [
  { id: 'chase', label: 'Chase' },
  { id: 'close', label: 'Close' },
  { id: 'high', label: 'High' },
  { id: 'smart', label: 'Smart' },
]

/** Pre-run: the car, the objective, power mode, steering help and camera. START runs the launch check. */
export function ReadyScreen() {
  const navigate = useNavigate()
  const { carId, challengeId } = useSessionStore()
  const prefs = usePrefsStore(s => s.prefs)
  const garageSelected = useGarageStore(s => s.selectedId)
  const cars = useGarageStore(s => s.cars)
  const loaded = useGarageStore(s => s.loaded)
  const thumbs = useGarageStore(s => s.thumbs)
  const activeId = carId ?? garageSelected
  const { doc, loading, missing } = useCarDoc(activeId)
  const [picker, setPicker] = useState(false)
  const [headsOpen, setHeadsOpen] = useState(false)

  const def = challengeId ? (getChallenge(challengeId) ?? null) : null
  const assessment = useMemo(() => (doc ? assessDrive(doc) : null), [doc])
  const state = readyState(def, assessment)
  const warnings = assessment?.warnings ?? []

  // Remembered drive options flow into the session so the Drive screen reads one place.
  useEffect(() => {
    const s = useSessionStore.getState()
    if (!s.carId && garageSelected)
      s.chooseCar(garageSelected)
    s.setDriveOptions({ assist: prefs.assist, camera: prefs.camera, cameraLock: prefs.cameraLock })
  }, [garageSelected, prefs.assist, prefs.camera, prefs.cameraLock])

  const goDrive = () => navigate('/drive')
  const launch = useLaunchCheck(() => assessment, goDrive, () => activeId && navigate(`/build/${activeId}`))

  const openFreeDrive = () => {
    useSessionStore.getState().chooseChallenge(null)
  }

  const title = def ? def.name.replace(/^(Kitchen|Garden) /, '') : 'Free drive'
  const noCar = loaded && (cars.length === 0 || missing)

  return (
    <div className="br-screen">
      <SceneBackdrop kind={def?.environment === 'garden' ? 'garden' : 'kitchen'} dim={0.3} />
      <ScreenHeader
        title="Ready to drive?"
        left={(
          <button type="button" className="btn br-btn br-cta !min-w-14 !min-h-14 !px-3" aria-label="Back to challenges" onClick={() => navigate('/play')}>
            <Icon name="back" size={26} />
          </button>
        )}
      />

      {noCar
        ? (
            <div className="br-layer br-fill flex flex-col items-center justify-center gap-3 text-center">
              <p className="br-display text-xl">{missing ? 'That car is not in the garage any more' : 'You need a car first'}</p>
              <button type="button" className="btn br-btn br-cta" onClick={() => navigate(cars.length ? '/' : '/starters')}>{cars.length ? 'Garage' : 'Build a car'}</button>
            </div>
          )
        : (
            <div className="ready-grid br-layer br-fill">
              <div className="ready-stage">
                {doc && (
                  <div className="ready-name br-panel">
                    <span className="br-display br-shadow text-lg">{doc.name}</span>
                    <Stripes count={3} />
                  </div>
                )}
                <CarViewport doc={doc} thumbnail={activeId ? thumbs[activeId] : undefined} className="absolute inset-0" zoom={1.12} />
                {warnings.length > 0 && (
                  <div className="ready-heads br-panel" role="status">
                    <button type="button" className="flex w-full items-center gap-2 text-left font-bold" aria-expanded={headsOpen} onClick={() => setHeadsOpen(v => !v)}>
                      <Icon name="warn" size={18} className="text-[var(--br-amber)]" />
                      {' '}
                      Heads up (
                      {warnings.length}
                      )
                    </button>
                    {headsOpen && (
                      <ul className="mt-1 list-disc pl-5">
                        {warnings.slice(0, 4).map(w => <li key={`${w.code}-${w.instanceIds.join(',')}`}>{w.message}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 z-[3]">
                  <button type="button" className="btn br-btn br-btn-sm" onClick={() => setPicker(true)}>
                    <Icon name="car" />
                    {' '}
                    Change car
                  </button>
                </div>
              </div>

              <section className="ready-panel br-panel" aria-label="Run settings">
                <div className="flex items-center gap-2">
                  <Icon name="flag" size={22} className="text-white" />
                  <h2 className="br-display flex-1 text-xl text-white">{title}</h2>
                  <Stripes />
                </div>
                <p className="text-[0.9rem] leading-tight">{def ? def.objective : 'Drive around with no finish. Reset any time.'}</p>

                <div className="ready-row">
                  <span className="flex items-center gap-2 font-black uppercase">
                    <Icon name="gear" size={20} />
                    {' '}
                    Power
                  </span>
                  <span className="ready-pill" data-testid="power-label">{powerLabel(def)}</span>
                </div>
                <label className="ready-row">
                  <span className="flex items-center gap-2 font-black uppercase">
                    <Icon name="target" size={20} />
                    {' '}
                    Steering help
                  </span>
                  <input
                    type="checkbox"
                    className="toggle br-toggle"
                    checked={prefs.assist === 'light'}
                    aria-label="Steering help"
                    onChange={e => usePrefsStore.getState().update({ assist: e.target.checked ? 'light' : 'off' })}
                  />
                </label>
                <label className="ready-row">
                  <span className="flex items-center gap-2 font-black uppercase">
                    <Icon name="camera" size={20} />
                    {' '}
                    Camera
                  </span>
                  <select
                    className="select br-select !min-h-10 w-36"
                    value={prefs.camera}
                    aria-label="Camera"
                    onChange={e => usePrefsStore.getState().update({ camera: e.target.value as CameraChoice })}
                  >
                    {CAMERAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="flex min-h-8 items-center gap-2 pl-1">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={prefs.cameraLock}
                    onChange={e => usePrefsStore.getState().update({ cameraLock: e.target.checked })}
                  />
                  <span>Lock camera behind car</span>
                </label>

                {state.kind !== 'ok' && (
                  <div role="alert" className="rounded-md border-2 border-[var(--br-amber)] bg-[rgba(255,200,61,0.12)] p-2 text-sm font-bold">
                    <p>{state.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {state.kind === 'too_big' && def && (
                        <button type="button" className="btn br-btn br-btn-sm" onClick={openFreeDrive}>Open free drive</button>
                      )}
                      <button type="button" className="btn br-btn br-btn-sm" onClick={() => activeId && navigate(`/build/${activeId}`)}>Back to editing</button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="btn br-cta mt-auto"
                  disabled={loading || !doc || state.kind === 'too_big'}
                  onClick={launch.start}
                >
                  Start
                  {' '}
                  <Icon name="play" size={26} />
                </button>
              </section>
            </div>
          )}

      {launch.dialog}
      {picker && (
        <CarPickerSheet
          currentId={activeId}
          onClose={() => setPicker(false)}
          onPick={(id) => {
            useGarageStore.getState().select(id)
            useSessionStore.getState().chooseCar(id)
            setPicker(false)
          }}
        />
      )}
    </div>
  )
}
