import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { SceneBackdrop } from '@/components/ui/SceneBackdrop'
import { ScreenHeader, Stripes } from '@/components/ui/ScreenHeader'
import { STARTERS } from '@/game/catalog/starters'
import { useGarageStore } from '@/stores/garage.store'
import { useStarterPreviews } from '../lib/use-starter-previews'
import { BricksArt } from './BricksArt'
import '../garage.css'

type Choice = 'racer' | 'buggy' | 'empty'

/** Choose Racer, Buggy or an empty build, then START BUILDING. */
export function StartersScreen() {
  const navigate = useNavigate()
  const previews = useStarterPreviews(420)
  const [choice, setChoice] = useState<Choice>('racer')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const start = async () => {
    setBusy(true)
    setFailed(false)
    const doc = await useGarageStore.getState().create(choice)
    setBusy(false)
    if (doc)
      navigate(`/build/${doc.carId}`)
    else
      setFailed(true)
  }

  const cards: Array<{ id: Choice, title: string, caption: string }> = [
    ...STARTERS.map(s => ({ id: s.id as Choice, title: s.name, caption: s.tagline })),
    { id: 'empty', title: 'Start empty', caption: 'Build your own' },
  ]

  return (
    <div className="br-screen">
      <SceneBackdrop kind="garage" />
      <ScreenHeader title="Choose your starter" />
      <div className="starters-grid br-layer br-fill" role="radiogroup" aria-label="Starter">
        {cards.map(card => (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={choice === card.id}
            className={`br-card starter-card ${choice === card.id ? 'is-selected' : ''}`}
            onClick={() => setChoice(card.id)}
          >
            <span className="starter-title br-display">
              {choice === card.id && <Icon name="check" size={20} className="text-[var(--br-cyan)]" />}
              <span>{card.title}</span>
              <Stripes count={3} />
            </span>
            <span className="starter-art">
              {card.id === 'empty'
                ? <BricksArt />
                : previews[card.id as 'racer' | 'buggy']
                  ? <img src={previews[card.id as 'racer' | 'buggy']!} alt="" draggable={false} />
                  : <span className="loading loading-spinner loading-lg text-primary" />}
            </span>
            <span className="br-caption">{card.caption}</span>
          </button>
        ))}
      </div>
      {failed && <p role="alert" className="br-layer text-center font-bold text-[var(--br-red)]">The car could not be saved on this device. Check your storage and try again.</p>}
      <div className="br-layer flex items-center justify-between gap-3">
        <button type="button" className="btn br-btn br-cta !min-w-16 !px-4" aria-label="Back to garage" onClick={() => navigate('/')}>
          <Icon name="back" size={28} />
        </button>
        <button type="button" className="btn br-cta" disabled={busy} onClick={start}>
          {busy ? 'Starting…' : 'Start building'} <Icon name="chevrons" size={30} />
        </button>
      </div>
    </div>
  )
}
