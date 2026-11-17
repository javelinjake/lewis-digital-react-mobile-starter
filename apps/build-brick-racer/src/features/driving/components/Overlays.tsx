import { Icon } from '@/components/ui/Icon'
import { Stripes } from '@/components/ui/ScreenHeader'

export function CountdownOverlay({ n }: { n: number | null }) {
  if (n === null)
    return null
  return (
    <div className="dr-countdown" role="status" aria-live="assertive" data-testid="countdown">
      <span key={n} className="br-display dr-countdown-num">{n === 0 ? 'GO!' : n}</span>
    </div>
  )
}

export function ResetPrompt({ onReset }: { onReset: () => void }) {
  return (
    <div className="dr-reset-prompt">
      <button type="button" className="btn br-btn br-cta br-pulse" onClick={onReset} data-testid="reset-prompt">
        <Icon name="restart" />
        {' '}
        Back on track? Reset
      </button>
    </div>
  )
}

export function FinishBanner({ finished, message }: { finished: boolean, message: string | null }) {
  return (
    <div className="dr-finish" role="status" data-testid="finish-banner">
      <div className="br-panel dr-finish-card">
        <Stripes />
        <span className="br-display dr-finish-title">{finished ? 'Finish!' : 'Run ended'}</span>
        <Stripes orange />
        {!finished && message && <p className="dr-finish-msg">{message}</p>}
      </div>
    </div>
  )
}

export function TryHint() {
  return (
    <div className="dr-try-hint br-panel" aria-hidden="true">
      <p className="br-display-sm">Steer with the left buttons · Brake on the right</p>
    </div>
  )
}
