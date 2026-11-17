import type { CameraChoice } from '@/game/persistence/types'
import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Stripes } from '@/components/ui/ScreenHeader'
import { usePrefsStore } from '@/stores/prefs.store'
import { KEY_HELP } from '../input/keyboard'

interface PauseProps {
  onResume: () => void
  onRestart: () => void
  onChangeCar: () => void
  onGarage: () => void
  onAssist: (on: boolean) => void
  onCamera: (mode: CameraChoice) => void
  busy: boolean
}

const CAMERAS: Array<{ id: CameraChoice, label: string }> = [
  { id: 'chase', label: 'Chase' },
  { id: 'close', label: 'Close chase' },
  { id: 'high', label: 'High view' },
  { id: 'smart', label: 'Smart camera' },
]

/** Pause dialog (design board): Resume, Restart, Change car, Garage, Settings. */
export function PauseOverlay({ onResume, onRestart, onChangeCar, onGarage, onAssist, onCamera, busy }: PauseProps) {
  const [view, setView] = useState<'menu' | 'settings'>('menu')
  const prefs = usePrefsStore(s => s.prefs)
  const update = usePrefsStore(s => s.update)
  const updateControls = usePrefsStore(s => s.updateControls)

  return (
    <div className="dr-pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" data-testid="pause-overlay">
      <div className="br-panel dr-pause-card">
        <header className="dr-pause-head">
          <Stripes />
          <h2 id="pause-title" className="br-display dr-pause-title">{view === 'menu' ? 'Paused' : 'Settings'}</h2>
          <Stripes orange />
          <button type="button" className="br-hud-btn dr-pause-close" aria-label="Close" onClick={onResume}>
            <Icon name="close" size={22} />
          </button>
        </header>

        {view === 'menu'
          ? (
              <>
                <button type="button" className="btn br-btn br-cta w-full" onClick={onResume} data-testid="resume" disabled={busy}>
                  <Icon name="play" />
                  {' '}
                  Resume
                </button>
                <div className="dr-pause-grid">
                  <button type="button" className="btn br-btn" onClick={onRestart} data-testid="restart" disabled={busy}>
                    <Icon name="restart" />
                    {' '}
                    Restart
                  </button>
                  <button type="button" className="btn br-btn" onClick={onChangeCar} data-testid="change-car" disabled={busy}>
                    <Icon name="car" />
                    {' '}
                    Change car
                  </button>
                  <button type="button" className="btn br-btn" onClick={onGarage} data-testid="to-garage" disabled={busy}>
                    <Icon name="garage" />
                    {' '}
                    Garage
                  </button>
                  <button type="button" className="btn br-btn" onClick={() => setView('settings')} data-testid="open-settings">
                    <Icon name="gear" />
                    {' '}
                    Settings
                  </button>
                </div>
                <details className="dr-keys">
                  <summary>Keyboard</summary>
                  <ul>
                    {KEY_HELP.map(k => (
                      <li key={k.action}>
                        <b>{k.keys}</b>
                        {' '}
                        {k.action}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )
          : (
              <div className="dr-settings">
                <label className="dr-row">
                  <span>Steering help</span>
                  <input
                    type="checkbox"
                    className="toggle br-toggle"
                    checked={prefs.assist === 'light'}
                    onChange={(e) => {
                      update({ assist: e.target.checked ? 'light' : 'off' })
                      onAssist(e.target.checked)
                    }}
                  />
                </label>
                <label className="dr-row">
                  <span>Camera</span>
                  <select
                    className="select br-select"
                    value={prefs.camera}
                    onChange={(e) => {
                      const mode = e.target.value as CameraChoice
                      update({ camera: mode })
                      onCamera(mode)
                    }}
                  >
                    {CAMERAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="dr-row">
                  <span>Left-handed</span>
                  <input type="checkbox" className="toggle br-toggle" checked={prefs.controls.leftHanded} onChange={e => updateControls({ leftHanded: e.target.checked })} />
                </label>
                <label className="dr-row">
                  <span>Control size</span>
                  <input type="range" className="range br-range" min={0.8} max={1.4} step={0.05} value={prefs.controls.scale} onChange={e => updateControls({ scale: Number(e.target.value) })} />
                </label>
                <p className="dr-note">Changing steering help mid-run makes it a practice run.</p>
                <button type="button" className="btn br-btn" onClick={() => setView('menu')}>
                  <Icon name="back" />
                  {' '}
                  Back
                </button>
              </div>
            )}
      </div>
    </div>
  )
}
