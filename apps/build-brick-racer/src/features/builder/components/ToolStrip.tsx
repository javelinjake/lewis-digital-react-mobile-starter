import type { ReactNode } from 'react'
import type { BuildMode } from '@/game/persistence/types'
import { Icon } from '@/components/ui/Icon'

interface ToolStripProps {
  mode: BuildMode
  placing: boolean
  hasSelection: boolean
  colour: string
  colourHex: string
  mirror: boolean
  /** Highlights the colour button during the colour coach step. */
  coachColour: boolean
  multi: boolean
  nudgeOpen: boolean
  emptyCar: boolean
  armed: { index: number, count: number } | null
  onRotate: () => void
  onColour: () => void
  onMirror: () => void
  onDelete: () => void
  onDuplicate: () => void
  onCancel: () => void
  onMulti: () => void
  onNudge: () => void
  onPlaceLoose: () => void
  onCycle: (direction: 1 | -1) => void
  onConfirmArmed: () => void
}

function Tool({ icon, label, onClick, active, testId, children, pulse, disabled }: {
  icon: React.ComponentProps<typeof Icon>['name']
  label: string
  onClick: () => void
  active?: boolean
  testId: string
  children?: ReactNode
  pulse?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`bd-tool ${active ? 'is-active' : ''} ${pulse ? 'br-pulse is-coach' : ''}`}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
    >
      {children ?? <Icon name={icon} size={26} />}
      <span>{label}</span>
    </button>
  )
}

/** Contextual tools beside the selected part or the part being placed. */
export function ToolStrip(p: ToolStripProps) {
  const free = p.mode === 'free'
  if (!p.placing && !p.hasSelection && !(free && p.emptyCar))
    return null
  return (
    <>
      {p.armed && (
        <div className="bd-cycle br-panel" role="group" aria-label="Choose between overlapping spots">
          <button type="button" className="bd-cycle-btn" aria-label="Previous spot" data-testid="cycle-prev" onClick={() => p.onCycle(-1)}><Icon name="arrow-left" size={28} /></button>
          <span className="bd-cycle-count" data-testid="cycle-count">
            {p.armed.index + 1}
            {' '}
            /
            {' '}
            {p.armed.count}
          </span>
          <button type="button" className="bd-cycle-btn" aria-label="Next spot" data-testid="cycle-next" onClick={() => p.onCycle(1)}><Icon name="arrow-right" size={28} /></button>
          <button type="button" className="btn br-btn br-cta bd-place-btn" aria-label="Place here" data-testid="place-here" onClick={p.onConfirmArmed}><Icon name="check" size={26} /></button>
        </div>
      )}
      <div className="bd-tools" role="toolbar" aria-label={p.placing ? 'Placing tools' : 'Selected piece tools'}>
        <Tool icon="rotate" label="Rotate" onClick={p.onRotate} testId="tool-rotate" />
        <Tool icon="paint" label="Colour" onClick={p.onColour} testId="tool-colour" pulse={p.coachColour}>
          <span className="bd-colour-dot" style={{ background: p.colourHex }} aria-hidden="true" />
        </Tool>
        {p.placing && <Tool icon="mirror" label="Mirror" active={p.mirror} onClick={p.onMirror} testId="tool-mirror" />}
        {p.placing && free && <Tool icon="loose" label="Place loose" onClick={p.onPlaceLoose} testId="place-loose" />}
        {!p.placing && free && <Tool icon="copy" label="Copy" onClick={p.onDuplicate} testId="tool-duplicate" disabled={!p.hasSelection} />}
        {!p.placing && free && <Tool icon="cube" label="Move" active={p.nudgeOpen} onClick={p.onNudge} testId="tool-nudge" disabled={!p.hasSelection} />}
        {!p.placing && free && <Tool icon="plus" label="Select more" active={p.multi} onClick={p.onMulti} testId="tool-multi" />}
        {!p.placing && <Tool icon="trash" label="Remove" onClick={p.onDelete} testId="tool-delete" disabled={!p.hasSelection} />}
        {(p.placing || p.hasSelection) && <Tool icon="close" label={p.placing ? 'Done' : 'Deselect'} onClick={p.onCancel} testId="tool-cancel" />}
      </div>
    </>
  )
}
