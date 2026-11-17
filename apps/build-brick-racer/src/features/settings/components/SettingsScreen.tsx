import type { BuildMode, CameraChoice } from '@/game/persistence/types'
import { useNavigate } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { SceneBackdrop } from '@/components/ui/SceneBackdrop'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { usePrefsStore } from '@/stores/prefs.store'
import { ControlPreview } from './ControlPreview'
import '../settings.css'

const CAMERAS: Array<{ id: CameraChoice, label: string }> = [
  { id: 'chase', label: 'Chase' },
  { id: 'close', label: 'Close' },
  { id: 'high', label: 'High' },
  { id: 'smart', label: 'Smart' },
]

function Row({ label, children, htmlFor }: { label: string, children: React.ReactNode, htmlFor?: string }) {
  return (
    <div className="set-row">
      <label htmlFor={htmlFor} className="flex-1">{label}</label>
      {children}
    </div>
  )
}

/** Settings: how you build, steer and see the game, plus sound and display. Everything saves as you change it. */
export function SettingsScreen() {
  const navigate = useNavigate()
  const prefs = usePrefsStore(s => s.prefs)
  const { update, updateControls, updateAudio } = usePrefsStore.getState()

  const done = () => {
    if ((window.history.state as { idx?: number } | null)?.idx)
      navigate(-1)
    else
      navigate('/', { replace: true })
  }

  const modes: Array<{ id: BuildMode, label: string }> = [{ id: 'easy', label: 'Easy' }, { id: 'free', label: 'Free' }]

  return (
    <div className="br-screen">
      <SceneBackdrop kind="garage" dim={0.3} />
      <ScreenHeader
        title="Settings"
        left={<button type="button" className="btn br-btn br-cta !min-w-14 !min-h-14 !px-3" aria-label="Back" onClick={done}><Icon name="back" size={26} /></button>}
      />

      <div className="set-grid br-layer br-fill">
        <section className="set-panel br-panel" aria-label="Play">
          <span className="set-tab">Play</span>
          <Row label="Build mode">
            <div className="set-seg" role="radiogroup" aria-label="Build mode">
              {modes.map(m => (
                <button key={m.id} type="button" role="radio" aria-checked={prefs.buildMode === m.id} className={`br-tab ${prefs.buildMode === m.id ? 'is-active' : ''}`} onClick={() => update({ buildMode: m.id })}>
                  {m.label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Steering help" htmlFor="set-assist">
            <input id="set-assist" type="checkbox" className="toggle br-toggle" checked={prefs.assist === 'light'} onChange={e => update({ assist: e.target.checked ? 'light' : 'off' })} />
          </Row>
          <Row label="Camera" htmlFor="set-camera">
            <select id="set-camera" className="select br-select w-36" value={prefs.camera} onChange={e => update({ camera: e.target.value as CameraChoice })}>
              {CAMERAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Row>
          <Row label="Left-handed" htmlFor="set-lefty">
            <input id="set-lefty" type="checkbox" className="toggle br-toggle" checked={prefs.controls.leftHanded} onChange={e => updateControls({ leftHanded: e.target.checked })} />
          </Row>
          <Row label="Control size" htmlFor="set-size">
            <ControlPreview leftHanded={prefs.controls.leftHanded} scale={prefs.controls.scale} />
            <input
              id="set-size"
              type="range"
              className="range br-range w-28"
              min={0.8}
              max={1.4}
              step={0.05}
              value={prefs.controls.scale}
              aria-valuetext={`${Math.round(prefs.controls.scale * 100)} percent`}
              onChange={e => updateControls({ scale: Number(e.target.value) })}
            />
          </Row>
        </section>

        <section className="set-panel br-panel" aria-label="Sound and display">
          <span className="set-tab">Sound &amp; display</span>
          <Row label="Music" htmlFor="set-music">
            <input id="set-music" type="range" className="range br-range w-40" min={0} max={1} step={0.05} value={prefs.audio.music} onChange={e => updateAudio({ music: Number(e.target.value) })} />
          </Row>
          <Row label="Effects" htmlFor="set-effects">
            <input id="set-effects" type="range" className="range br-range w-40" min={0} max={1} step={0.05} value={prefs.audio.effects} onChange={e => updateAudio({ effects: Number(e.target.value) })} />
          </Row>
          <Row label="Mute all sound" htmlFor="set-mute">
            <input id="set-mute" type="checkbox" className="toggle br-toggle" checked={prefs.audio.muted} onChange={e => updateAudio({ muted: e.target.checked })} />
          </Row>
          <Row label="Reduced motion" htmlFor="set-motion">
            <input id="set-motion" type="checkbox" className="toggle br-toggle" checked={prefs.reducedMotion} onChange={e => update({ reducedMotion: e.target.checked })} />
          </Row>
          <Row label="Vibration" htmlFor="set-vibration">
            <input id="set-vibration" type="checkbox" className="toggle br-toggle" checked={prefs.vibration} onChange={e => update({ vibration: e.target.checked })} />
          </Row>
        </section>
      </div>

      <div className="br-layer flex items-center justify-end gap-3">
        <button type="button" className="btn br-btn" onClick={() => navigate('/help')}>
          <Icon name="help" />
          {' '}
          Help
        </button>
        <button type="button" className="btn br-cta" onClick={done}>
          Done
          <Icon name="chevrons" size={30} />
        </button>
      </div>
    </div>
  )
}
