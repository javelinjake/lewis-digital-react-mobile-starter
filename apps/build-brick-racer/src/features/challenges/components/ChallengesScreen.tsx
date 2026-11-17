import type { ProgressRecord } from '@/game/persistence/types'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { SceneBackdrop } from '@/components/ui/SceneBackdrop'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { challengesIn } from '@/game/challenges'
import { getRepo } from '@/lib/platform/repo'
import { useGarageStore } from '@/stores/garage.store'
import { usePrefsStore } from '@/stores/prefs.store'
import { useSessionStore } from '@/stores/session.store'
import { fallbackThumbnailSafe } from '../lib/thumb'
import { ChallengeCard } from './ChallengeCard'
import '../challenges.css'

/** Choose Kitchen or Garden, then a challenge (or free drive). Every challenge is always selectable. */
export function ChallengesScreen() {
  const navigate = useNavigate()
  const { place, challengeId, carId } = useSessionStore()
  const assist = usePrefsStore(s => s.prefs.assist)
  const garageCar = useGarageStore(s => s.selectedId)
  const cars = useGarageStore(s => s.cars)
  const thumbs = useGarageStore(s => s.thumbs)
  const loaded = useGarageStore(s => s.loaded)
  const [progress, setProgress] = useState<ProgressRecord[]>([])

  useEffect(() => {
    let cancelled = false
    void getRepo().listProgress().then((p) => {
      if (!cancelled)
        setProgress(p)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const activeCar = carId ?? garageCar
  const list = challengesIn(place)

  useEffect(() => {
    const s = useSessionStore.getState()
    if (!s.carId && garageCar)
      s.chooseCar(garageCar)
  }, [garageCar])

  // A place with no remembered route starts on its first challenge.
  useEffect(() => {
    const s = useSessionStore.getState()
    if (s.lastChallengeByPlace[s.place] === undefined && !list.some(c => c.id === s.challengeId))
      s.chooseChallenge(list[0]?.id ?? null)
  }, [place, list])

  const switchPlace = (next: 'kitchen' | 'garden') => {
    const s = useSessionStore.getState()
    s.choosePlace(next)
    if (useSessionStore.getState().lastChallengeByPlace[next] === undefined)
      s.chooseChallenge(challengesIn(next)[0]?.id ?? null)
  }

  const noCar = loaded && cars.length === 0
  const carThumb = activeCar ? (thumbs[activeCar] ?? fallbackThumbnailSafe(cars.find(c => c.id === activeCar)?.name ?? 'Car')) : undefined

  return (
    <div className="br-screen">
      <SceneBackdrop kind={place === 'garden' ? 'garden' : 'kitchen'} dim={0.28} />
      <ScreenHeader
        title="Choose a challenge"
        left={(
          <button type="button" className="btn br-btn br-cta !min-w-14 !min-h-14 !px-3" aria-label="Back to garage" onClick={() => navigate('/')}>
            <Icon name="back" size={26} />
          </button>
        )}
      />
      <div className="ch-tabs br-layer" role="tablist" aria-label="Place">
        {(['kitchen', 'garden'] as const).map(p => (
          <button key={p} type="button" role="tab" aria-selected={place === p} className={`br-tab ${place === p ? 'is-active' : ''}`} onClick={() => switchPlace(p)}>
            {p === 'kitchen' ? 'Kitchen' : 'Garden'}
          </button>
        ))}
      </div>

      {noCar
        ? (
            <div className="br-layer br-fill flex flex-col items-center justify-center gap-3 text-center">
              <p className="br-display text-xl">You need a car first</p>
              <button type="button" className="btn br-btn br-cta" onClick={() => navigate('/starters')}>
                <Icon name="plus" />
                {' '}
                Build a car
              </button>
            </div>
          )
        : (
            <div className="ch-row br-layer br-fill br-scroll-x" role="radiogroup" aria-label="Challenges">
              {list.map(def => (
                <ChallengeCard
                  key={def.id}
                  def={def}
                  selected={challengeId === def.id}
                  assist={assist}
                  progress={progress}
                  carThumb={carThumb}
                  onSelect={() => useSessionStore.getState().chooseChallenge(def.id)}
                />
              ))}
            </div>
          )}

      <div className="br-layer flex items-center justify-between gap-3">
        <button
          type="button"
          className={`btn br-btn ${challengeId === null ? 'br-selected' : ''}`}
          aria-pressed={challengeId === null}
          disabled={noCar}
          onClick={() => {
            useSessionStore.getState().chooseChallenge(null)
            navigate('/ready')
          }}
        >
          <Icon name="car" />
          {' '}
          Free drive
        </button>
        <button type="button" className="btn br-cta" disabled={noCar || !challengeId} onClick={() => navigate('/ready')}>
          Next
          {' '}
          <Icon name="chevrons" size={30} />
        </button>
      </div>
    </div>
  )
}
