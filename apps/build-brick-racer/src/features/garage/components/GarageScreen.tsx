import { ConfirmDialog } from '@ld/ui'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { SceneBackdrop } from '@/components/ui/SceneBackdrop'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { CarViewport } from '@/components/viewport/CarViewport'
import { useCarDoc } from '@/components/viewport/use-car-doc'
import { useGarageStore } from '@/stores/garage.store'
import { useSessionStore } from '@/stores/session.store'
import { installScreensTestHook } from '../lib/dev-hooks'
import { FirstPlay } from './FirstPlay'
import { RenameDialog } from './RenameDialog'
import '../garage.css'

installScreensTestHook()

/** Garage: the selected car large on its mat, the rest as thumbnails, and the three big actions. */
export function GarageScreen() {
  const navigate = useNavigate()
  const { cars, thumbs, selectedId, loaded, error } = useGarageStore()
  const select = useGarageStore(s => s.select)
  const interrupted = useSessionStore(s => s.interrupted)
  const { doc } = useCarDoc(selectedId)
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void useGarageStore.getState().refresh()
  }, [])

  const selected = cars.find(c => c.id === selectedId) ?? null
  const others = cars.filter(c => c.id !== selectedId)
  const firstPlay = loaded && cars.length === 0

  const drive = () => {
    if (!selected)
      return
    useSessionStore.getState().chooseCar(selected.id)
    navigate('/play')
  }

  const restartInterrupted = () => {
    if (!interrupted)
      return
    const s = useSessionStore.getState()
    s.chooseCar(interrupted.carId)
    const def = interrupted.challengeId
    if (def && (def.startsWith('kitchen') || def.startsWith('garden'))) {
      s.choosePlace(def.startsWith('garden') ? 'garden' : 'kitchen')
      s.chooseChallenge(def as Parameters<typeof s.chooseChallenge>[0])
    }
    s.setInterrupted(null)
    navigate('/ready')
  }

  return (
    <div className="br-screen">
      <SceneBackdrop kind="garage" />
      <ScreenHeader
        title="My Garage"
        left={(
          <button type="button" className="btn br-btn br-btn-icon" aria-label="Help" onClick={() => navigate('/help')}>
            <Icon name="help" size={26} />
          </button>
        )}
        right={(
          <button type="button" className="btn br-btn br-btn-icon" aria-label="Settings" onClick={() => navigate('/settings')}>
            <Icon name="gear" size={26} />
          </button>
        )}
      />

      {!loaded && (
        <div className="br-layer br-fill flex items-center justify-center" role="status">
          <span className="loading loading-spinner loading-lg text-primary" />
          <span className="ml-3 text-lg font-bold">Opening the garage…</span>
        </div>
      )}

      {error && (
        <div role="alert" className="br-layer br-panel text-center font-bold">
          {error}
          <button type="button" className="btn br-btn br-btn-sm ml-3" onClick={() => void useGarageStore.getState().refresh()}>Try again</button>
        </div>
      )}

      {firstPlay && <FirstPlay />}

      {loaded && !firstPlay && (
        <>
          <div className="garage-stage br-layer br-fill">
            <div className="garage-main">
              {selected && (
                <div className="garage-namebar">
                  <div className="br-panel">
                    <span className="br-display garage-name br-shadow" title={selected.name}>{selected.name}</span>
                    <button type="button" className="btn br-btn garage-iconbtn" aria-label="Rename car" onClick={() => setRenaming(true)}>
                      <Icon name="pencil" size={22} />
                    </button>
                    <button type="button" className="btn br-btn garage-iconbtn" aria-label="More car options" aria-expanded={menu} onClick={() => setMenu(v => !v)}>
                      <Icon name="dots" size={22} />
                    </button>
                  </div>
                </div>
              )}
              {menu && selected && (
                <div className="garage-menu br-panel" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="btn br-btn br-btn-sm justify-start"
                    onClick={() => {
                      setMenu(false)
                      void useGarageStore.getState().duplicate(selected.id)
                    }}
                  >
                    <Icon name="copy" />
                    {' '}
                    Duplicate
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="btn br-btn br-btn-sm br-btn-danger justify-start"
                    onClick={() => {
                      setMenu(false)
                      setDeleting(true)
                    }}
                  >
                    <Icon name="trash" />
                    {' '}
                    Delete
                  </button>
                </div>
              )}
              {interrupted && (
                <div className="garage-notice br-panel" role="status">
                  <p className="font-bold">Your last run was interrupted. It was not saved as a result.</p>
                  <div className="flex gap-2">
                    <button type="button" className="btn br-btn br-btn-sm" onClick={restartInterrupted}>Restart challenge</button>
                    <button type="button" className="btn br-btn br-btn-sm" onClick={() => useSessionStore.getState().setInterrupted(null)}>Dismiss</button>
                  </div>
                </div>
              )}
              <CarViewport doc={doc} thumbnail={selectedId ? thumbs[selectedId] : undefined} className="absolute inset-0" zoom={1.15} />
            </div>

            <aside className="garage-side br-scroll" aria-label="Your other cars">
              {others.map(c => (
                <button key={c.id} type="button" className="br-card garage-thumb" onClick={() => select(c.id)} aria-label={`Show ${c.name}`}>
                  {thumbs[c.id]
                    ? <img src={thumbs[c.id]} alt="" draggable={false} />
                    : <span className="garage-thumb-empty" aria-hidden="true"><Icon name="car" size={36} /></span>}
                  <span className="br-caption">{c.name}</span>
                </button>
              ))}
            </aside>
          </div>

          <div className="garage-actions br-layer">
            <button type="button" className="btn br-btn" onClick={() => navigate('/starters')}>
              <Icon name="plus" />
              {' '}
              Build a car
            </button>
            <button type="button" className="btn br-btn" disabled={!selected} onClick={() => selected && navigate(`/build/${selected.id}`)}>
              <Icon name="pencil" />
              {' '}
              Edit car
            </button>
            <button type="button" className="btn br-cta" disabled={!selected} onClick={drive}>
              Drive
              {' '}
              <Icon name="chevrons" size={30} />
            </button>
          </div>
        </>
      )}

      {renaming && selected && (
        <RenameDialog
          name={selected.name}
          onClose={() => setRenaming(false)}
          onSave={(name) => {
            setRenaming(false)
            void useGarageStore.getState().rename(selected.id, name)
          }}
        />
      )}
      <ConfirmDialog
        open={deleting && Boolean(selected)}
        title={`Delete ${selected?.name ?? 'this car'}?`}
        body="The car is removed from your garage. Past results and replays keep their own copy of the car, so your history stays safe."
        confirmLabel="Delete"
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false)
          if (selected)
            void useGarageStore.getState().remove(selected.id)
        }}
      />
    </div>
  )
}
