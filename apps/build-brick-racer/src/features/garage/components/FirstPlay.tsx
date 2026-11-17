import { useNavigate } from 'react-router'
import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { prepareTryACar } from '../lib/try-a-car'
import { useStarterPreviews } from '../lib/use-starter-previews'
import { BricksArt } from './BricksArt'

/** First play: two large actions. No cars yet, so nothing else to show. */
export function FirstPlay() {
  const navigate = useNavigate()
  const previews = useStarterPreviews(420)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tryCar = async () => {
    setBusy(true)
    setError(null)
    const id = await prepareTryACar()
    setBusy(false)
    if (id)
      navigate('/drive')
    else
      setError('The car could not be saved on this device. Check your storage and try again.')
  }

  return (
    <>
      <div className="firstplay br-layer br-fill">
        <button type="button" className="br-card firstplay-card" onClick={() => navigate('/starters')} aria-label="Build a car">
          <BricksArt className="" />
          <span className="btn br-btn br-cta pointer-events-none" aria-hidden="true">
            <Icon name="plus" /> Build a car
          </span>
        </button>
        <button type="button" className="br-card firstplay-card" disabled={busy} onClick={tryCar} aria-label="Try a car">
          {previews.racer ? <img src={previews.racer} alt="" draggable={false} /> : <span className="loading loading-spinner loading-lg text-primary" />}
          <span className="btn br-btn pointer-events-none" aria-hidden="true">
            <Icon name="flag" /> {busy ? 'Getting ready…' : 'Try a car'}
          </span>
        </button>
      </div>
      {error && <p role="alert" className="br-layer text-center font-bold text-[var(--br-red)]">{error}</p>}
    </>
  )
}
