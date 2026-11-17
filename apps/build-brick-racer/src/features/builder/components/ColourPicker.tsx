import { Icon } from '@/components/ui/Icon'
import { PALETTE } from '@/game/catalog/palette'

/** Twelve clear colours. Colour has no physical effect. The selected swatch shows a tick as well as a ring. */
export function ColourPicker({ colour, onPick, onClose }: { colour: string, onPick: (id: string) => void, onClose: () => void }) {
  return (
    <div className="bd-popover br-panel" role="dialog" aria-label="Choose a colour" data-testid="colour-picker">
      <div className="bd-swatches" role="radiogroup" aria-label="Colours">
        {PALETTE.map(c => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === colour}
            aria-label={c.label}
            data-testid={`colour-${c.id}`}
            className={`bd-swatch ${c.id === colour ? 'is-on' : ''}`}
            style={{ background: c.hex }}
            onClick={() => onPick(c.id)}
          >
            {c.id === colour && <Icon name="check" size={22} className={c.id === 'white' || c.id === 'yellow' ? 'text-black' : 'text-white'} />}
          </button>
        ))}
      </div>
      <button type="button" className="btn br-btn br-btn-sm mt-2 w-full" onClick={onClose}>Done</button>
    </div>
  )
}
