import type { IconName } from '@/components/ui/Icon'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { SceneBackdrop } from '@/components/ui/SceneBackdrop'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { defaultContext } from '@/game/build/doc'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { usePrefsStore } from '@/stores/prefs.store'
import '../settings.css'

type Section = 'build' | 'drive' | 'cameras'

const SECTIONS: Array<{ id: Section, label: string, icon: IconName, callout: string, tips: Array<{ icon: IconName, text: string }> }> = [
  {
    id: 'build',
    label: 'Build',
    icon: 'brick',
    callout: 'Tap a highlighted spot',
    tips: [
      { icon: 'plus', text: 'Pick a part, then tap a glowing spot.' },
      { icon: 'rotate', text: 'Turn it with the big rotate button.' },
      { icon: 'undo', text: 'Undo is always there.' },
    ],
  },
  {
    id: 'drive',
    label: 'Drive',
    icon: 'flag',
    callout: 'Steer on one side, go on the other',
    tips: [
      { icon: 'car', text: 'Steer with the arrows. Gas and brake are on the other side.' },
      { icon: 'restart', text: 'Stuck or upside down? Tap reset.' },
      { icon: 'flag', text: 'Go through the gates in order to finish.' },
    ],
  },
  {
    id: 'cameras',
    label: 'Cameras',
    icon: 'camera',
    callout: 'Tap the camera to change view',
    tips: [
      { icon: 'camera', text: 'Chase, Close, High or Smart.' },
      { icon: 'lock', text: 'Lock keeps your view steady.' },
      { icon: 'eye', text: 'Replays show your run from any side.' },
    ],
  },
]

/** A starter car picture for the example. Rendered once, falls back to a plain brick icon. */
function useExampleCar(): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const render = await import('@/render')
        const picture = await render.renderCarThumbnail(buildStarter('racer', defaultContext), catalog, { size: 420 })
        if (!cancelled)
          setUrl(picture)
      }
      catch {
        // The example still works without a picture.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return url
}

/** Building help: a short, icon-led board that can be opened again any time. */
export function HelpScreen() {
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('build')
  const [reset, setReset] = useState(false)
  const car = useExampleCar()
  const current = SECTIONS.find(s => s.id === section)!

  const leave = () => {
    usePrefsStore.getState().completeTutorial('help-seen')
    if ((window.history.state as { idx?: number } | null)?.idx)
      navigate(-1)
    else
      navigate('/', { replace: true })
  }

  return (
    <div className="br-screen">
      <SceneBackdrop kind="garage" dim={0.3} />
      <ScreenHeader
        title="Building help"
        left={<button type="button" className="btn br-btn br-cta !min-w-14 !min-h-14 !px-3" aria-label="Back" onClick={leave}><Icon name="back" size={26} /></button>}
        right={(
          <button type="button" className="btn br-btn br-btn-sm" onClick={leave}>
            Skip
            <Icon name="chevrons" size={22} />
          </button>
        )}
      />

      <div className="help-grid br-layer br-fill">
        <nav className="help-rail br-panel" role="tablist" aria-label="Help topics">
          {SECTIONS.map(s => (
            <button key={s.id} type="button" role="tab" aria-selected={section === s.id} onClick={() => setSection(s.id)}>
              <Icon name={s.icon} size={28} />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="help-stage">
          <div className="help-art" aria-hidden="true">
            <div className="help-callout br-panel">{current.callout}</div>
            {car ? <img src={car} alt="" draggable={false} /> : <div className="flex h-full items-center justify-center"><Icon name="car" size={96} className="opacity-60" /></div>}
            {section === 'build' && (
              <svg className="absolute left-[28%] top-[26%] h-[40%] w-[44%]" viewBox="0 0 120 80">
                <g fill="none" stroke="#6dff8a" strokeWidth="3">
                  <ellipse cx="30" cy="62" rx="12" ry="5" />
                  <ellipse cx="60" cy="68" rx="12" ry="5" />
                  <ellipse cx="90" cy="62" rx="12" ry="5" />
                </g>
                <rect x="14" y="10" width="92" height="26" rx="5" fill="rgba(109,255,138,0.55)" stroke="#6dff8a" strokeWidth="2" />
                <path d="M30 40v14M60 40v18M90 40v14" stroke="#6dff8a" strokeWidth="3" markerEnd="url(#a)" />
              </svg>
            )}
          </div>
          <ul className="help-tips br-panel" aria-label={`${current.label} tips`}>
            {current.tips.map(t => (
              <li key={t.text} className="help-tip">
                <span className="help-tip-icon"><Icon name={t.icon} size={22} /></span>
                {t.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="br-layer flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn br-btn br-btn-sm"
            onClick={() => {
              usePrefsStore.getState().resetTutorial()
              setReset(true)
            }}
          >
            <Icon name="restart" />
            {' '}
            Replay the building tutorial
          </button>
          {reset && <span role="status" className="font-bold text-[var(--br-green)]">Done. It shows the next time you build.</span>}
        </div>
        <button type="button" className="btn br-cta" onClick={leave}>
          Got it
          <Icon name="chevrons" size={30} />
        </button>
      </div>
    </div>
  )
}
