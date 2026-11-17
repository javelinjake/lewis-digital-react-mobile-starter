import type { PadDirection } from '@/features/builder/logic/nudge'
import { Icon } from '@/components/ui/Icon'

/** Grouped move for Free Build: one stud sideways or one plate up and down per tap, relative to the screen. */
export function NudgePad({ onStep }: { onStep: (dir: PadDirection) => void }) {
  const btn = (dir: PadDirection, label: string, content: React.ReactNode) => (
    <button type="button" className="bd-pad-btn" aria-label={label} data-testid={`nudge-${dir}`} onClick={() => onStep(dir)}>
      {content}
    </button>
  )
  return (
    <div className="bd-pad br-panel" role="group" aria-label="Move selected pieces">
      {btn('up', 'Move up one plate', <span className="bd-pad-text">Up</span>)}
      {btn('away', 'Move away', <Icon name="arrow-up" />)}
      {btn('down', 'Move down one plate', <span className="bd-pad-text">Down</span>)}
      {btn('left', 'Move left', <Icon name="arrow-left" />)}
      <span className="bd-pad-mid" aria-hidden="true"><Icon name="cube" size={20} /></span>
      {btn('right', 'Move right', <Icon name="arrow-right" />)}
      <span />
      {btn('toward', 'Move toward you', <Icon name="arrow-down" />)}
      <span />
    </div>
  )
}
