import type { ChallengeDefinition } from '@/game/challenges/types'
import type { CameraChoice } from '@/game/persistence/types'
import { Icon } from '@/components/ui/Icon'

const CAMERA_LABEL: Record<CameraChoice, string> = { chase: 'Chase', close: 'Close', high: 'High', smart: 'Smart' }

export interface HudProps {
  challenge: ChallengeDefinition | null
  placeLabel: string
  camera: CameraChoice
  locked: boolean
  onPause: () => void
  onReset: () => void
  onCamera: () => void
  onLock: () => void
}

/**
 * Static HUD markup. Live values (`data-hud` nodes) are written straight to the DOM by the game loop; this
 * component re-renders only when the screen's phase or camera choice changes, never per frame.
 */
export function Hud({ challenge, placeLabel, camera, locked, onPause, onReset, onCamera, onLock }: HudProps) {
  return (
    <>
      <div className="dr-top-left">
        <div className="br-panel dr-objective" data-testid="objective">
          <Icon name="flag" size={20} />
          <div className="min-w-0">
            <div className="br-display-sm dr-objective-title">{challenge ? challenge.shortName : `Free drive · ${placeLabel}`}</div>
            <div className="dr-objective-text">{challenge ? challenge.objective : 'Drive anywhere. Reset any time.'}</div>
          </div>
        </div>
        <span className="dr-chip is-hidden" data-hud="practice" />
      </div>

      <div className="dr-top-center">
        <div className="br-panel dr-time" aria-label="Elapsed time">
          <span className="br-display" data-hud="time">00:00.0</span>
        </div>
        <div className="dr-progress is-hidden" data-hud="progressBar" aria-hidden="true"><i /></div>
      </div>

      <div className="dr-top-right">
        <button type="button" className="br-hud-btn" aria-label="Camera" onClick={onCamera} data-testid="camera-button">
          <Icon name="camera" size={24} />
          <span className="dr-camera-tag">{CAMERA_LABEL[camera]}</span>
        </button>
        <button type="button" className={`br-hud-btn ${locked ? 'is-on' : ''}`} aria-label="Lock camera" aria-pressed={locked} onClick={onLock} data-testid="lock-button">
          <Icon name="lock" size={22} />
        </button>
        <button type="button" className="br-hud-btn" aria-label="Reset car" onClick={onReset} data-testid="reset-button">
          <Icon name="restart" size={24} />
        </button>
        <button type="button" className="br-hud-btn" aria-label="Pause" onClick={onPause} data-testid="pause-button">
          <Icon name="pause" size={24} />
        </button>
      </div>

      <div className="dr-badges" aria-live="polite">
        <span className="dr-badge is-motor is-hidden" data-hud="motor" />
        <span className="dr-badge is-reverse is-hidden" data-hud="reverse">R · Reversing</span>
        <span className="dr-badge is-air is-hidden" data-hud="airborne">Airborne</span>
      </div>

      <div className="br-panel dr-cue is-hidden" data-hud="cue">
        <div className="br-display-sm dr-cue-title" data-hud="cueTitle" />
        <div className="dr-cue-detail" data-hud="cueDetail" />
        <div className="dr-band is-hidden" data-hud="band" aria-hidden="true">
          <i className="dr-band-zone" data-hud="bandZone" />
          <i className="dr-band-marker" data-hud="bandMarker" />
        </div>
      </div>

      <div className="dr-message is-hidden" data-hud="message" role="status" />

      <div className="dr-speed" aria-label="Speed">
        <span className="br-display dr-speed-value" data-hud="speed" data-testid="speed">0.0</span>
        <span className="dr-speed-unit">m/s</span>
      </div>
    </>
  )
}
