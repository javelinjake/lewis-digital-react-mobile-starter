import type { TutorialStep } from '@/features/builder/logic/hooks'
import type { ViewPreset } from '@/features/builder/logic/orbit'
import type { BuildIssue } from '@/game/build/types'
import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

export function ViewButtons({ onView }: { onView: (v: ViewPreset) => void }) {
  const views: Array<[ViewPreset, string]> = [['threeQuarter', '3/4'], ['front', 'Front'], ['side', 'Side'], ['top', 'Top']]
  return (
    <div className="bd-views" role="group" aria-label="Camera views">
      {views.map(([v, label]) => (
        <button key={v} type="button" className="bd-view-btn" data-testid={`view-${v}`} aria-label={`${label} view`} onClick={() => onView(v)}>{label}</button>
      ))}
    </div>
  )
}

export function IssueBanner({ issues, onDismiss }: { issues: BuildIssue[], onDismiss: () => void }) {
  const first = issues[0]
  if (!first)
    return null
  return (
    <button type="button" className="bd-banner is-error" role="alert" data-testid="issue-banner" onClick={onDismiss}>
      <Icon name="warn" size={24} />
      <span>{first.message}</span>
      <small>Nothing was changed. Tap to hide.</small>
    </button>
  )
}

export function Notice({ text, onDismiss }: { text: string | null, onDismiss: () => void }) {
  if (!text)
    return null
  return (
    <button type="button" className="bd-banner is-info" role="status" data-testid="notice" onClick={onDismiss}>
      <Icon name="info" size={24} />
      <span>{text}</span>
    </button>
  )
}

/** Compact, never blocking. Each warning highlights its pieces when tapped. */
export function HeadsUp({ warnings, onFocus }: { warnings: BuildIssue[], onFocus: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const unique = warnings.filter((w, i) => warnings.findIndex(x => x.message === w.message) === i)
  if (unique.length === 0)
    return null
  return (
    <div className="bd-headsup">
      <button type="button" className="bd-chip-amber" aria-expanded={open} data-testid="heads-up" onClick={() => setOpen(v => !v)}>
        <Icon name="warn" size={18} />
        <span>
          Heads up (
          {unique.length}
          )
        </span>
      </button>
      {open && (
        <ul className="bd-headsup-list br-panel" aria-label="Heads up">
          {unique.map(w => (
            <li key={`${w.code}-${w.message}`}>
              <button type="button" onClick={() => onFocus(w.instanceIds)}>
                <Icon name="warn" size={16} />
                <span>{w.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function LooseChip({ count, onSelect }: { count: number, onSelect: () => void }) {
  if (count === 0)
    return null
  return (
    <button type="button" className="bd-chip-amber is-loose" data-testid="loose-chip" onClick={onSelect}>
      <Icon name="loose" size={18} />
      <span>
        {count}
        {' '}
        loose piece
        {count === 1 ? '' : 's'}
      </span>
    </button>
  )
}

const COACH: Record<TutorialStep, { n: number, text: string }> = {
  'build-brick': { n: 1, text: 'Choose a brick' },
  'build-place': { n: 2, text: 'Tap a highlighted spot' },
  'build-colour': { n: 3, text: 'Change its colour' },
}

/** One short instruction at a time. It never blocks the editor and can be skipped. */
export function CoachMark({ step, onSkip }: { step: TutorialStep, onSkip: () => void }) {
  const c = COACH[step]
  return (
    <div className="bd-coach br-panel" role="status" data-testid="coach" data-step={step}>
      <span className="bd-coach-n">{c.n}</span>
      <b>{c.text}</b>
      <button type="button" className="bd-coach-skip" onClick={onSkip}>Skip</button>
    </div>
  )
}

/** "Remove this part?" second action for structural or supporting pieces. */
export function DeleteSheet({ count, structural, detached, onCancel, onConfirm }: {
  count: number
  structural: boolean
  detached: number
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal modal-open z-50" role="dialog" aria-modal="true" aria-labelledby="del-title" data-testid="delete-sheet">
      <div className="modal-box br-panel max-w-md !rounded-none bg-transparent p-4">
        <h2 id="del-title" className="br-display flex items-center gap-2 text-xl">
          <Icon name="trash" />
          {' '}
          Remove this part?
        </h2>
        <p className="mt-3 text-base">
          {structural && 'This is part of the car’s frame. '}
          {detached > 0
            ? `${detached} other piece${detached === 1 ? '' : 's'} would come loose. They stay in your garage so you can connect them again.`
            : count > 1 ? `${count} pieces will be removed.` : 'You can undo this.'}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn br-btn" data-testid="delete-keep" onClick={onCancel}>Keep it</button>
          <button type="button" className="btn br-btn br-btn-danger" data-testid="delete-confirm" onClick={onConfirm}>Remove</button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Keep it" onClick={onCancel} />
    </div>
  )
}
