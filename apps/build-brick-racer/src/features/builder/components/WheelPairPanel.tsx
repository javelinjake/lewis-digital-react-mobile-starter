import { Icon } from '@/components/ui/Icon'
import { PartThumb } from '@/features/builder/components/PartThumb'
import { catalog } from '@/game/catalog/catalog'

const WHEELS = ['wheel_small', 'wheel_road', 'wheel_wide', 'wheel_offroad'] as const

/**
 * Paired wheel change. The pieces that will change are outlined in yellow in the viewport while this panel
 * is open. The swap is one atomic transaction: if any wheel cannot take the new part, nothing changes.
 */
export function WheelPairPanel({ currentDefId, count, grouped, onPick, onClose }: {
  currentDefId: string
  count: number
  grouped: boolean
  onPick: (defId: string) => void
  onClose: () => void
}) {
  return (
    <aside className="bd-wheelpanel br-panel" aria-label="Change wheels" data-testid="wheel-panel">
      <header className="flex items-center justify-between gap-2">
        <h2 className="br-display-sm text-base">{grouped ? `Change both wheels` : 'Change wheels'}</h2>
        <button type="button" className="bd-x" aria-label="Close wheel panel" onClick={onClose}><Icon name="close" size={20} /></button>
      </header>
      <p className="bd-note">
        {grouped
          ? `The ${count} outlined wheels will change together.`
          : 'This wheel is not in a pair yet. Select the wheels you want to change.'}
      </p>
      <div className="bd-wheel-grid" role="radiogroup" aria-label="Wheel type">
        {WHEELS.map((id) => {
          const def = catalog.get(id)!
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === currentDefId}
              disabled={!grouped}
              className={`bd-wheel-opt ${id === currentDefId ? 'is-selected' : ''}`}
              data-testid={`swap-${id}`}
              onClick={() => onPick(id)}
            >
              <PartThumb def={def} size={40} />
              <span>{def.label}</span>
              {id === currentDefId && <Icon name="check" size={16} />}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
