import type { IconName } from '@/components/ui/Icon'
import type { LayoutKind } from '@/features/builder/logic/hooks'
import type { PartCategory } from '@/game/catalog/types'
import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { PartThumb } from '@/features/builder/components/PartThumb'
import { catalog, CATEGORY_LABELS, CATEGORY_ORDER } from '@/game/catalog/catalog'

const CATEGORY_ICON: Record<PartCategory, IconName> = {
  bricks: 'brick',
  plates: 'cube',
  beams: 'ruler',
  shaped: 'cube',
  fittings: 'car',
  wheels: 'wheel',
  details: 'flag',
}

interface PartsTrayProps {
  layout: LayoutKind
  category: PartCategory
  onCategory: (c: PartCategory) => void
  partId: string | null
  onPart: (defId: string | null) => void
}

/** Unlimited copies of every shipped part. Phones: bottom tray. Tablets: left rail. */
export function PartsTray({ layout, category, onCategory, partId, onPart }: PartsTrayProps) {
  const [collapsed, setCollapsed] = useState(false)
  const parts = useMemo(() => catalog.byCategory(category), [category])
  const showCards = layout === 'rail' || !collapsed
  const pickedLabel = partId ? catalog.get(partId)?.label : undefined

  return (
    <section className="bd-tray br-panel" data-layout={layout} aria-label="Parts tray" data-testid="tray">
      <div className="bd-chips" role="tablist" aria-label="Part categories">
        {CATEGORY_ORDER.map(c => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === category}
            className={`br-tab bd-chip ${c === category ? 'is-active' : ''}`}
            data-testid={`cat-${c}`}
            onClick={() => {
              onCategory(c)
              setCollapsed(false)
            }}
          >
            <Icon name={CATEGORY_ICON[c]} size={20} />
            <span>{CATEGORY_LABELS[c]}</span>
          </button>
        ))}
        {layout === 'bottom' && collapsed && pickedLabel && <span className="bd-picked" data-testid="picked-part">{pickedLabel}</span>}
        {layout === 'bottom' && (
          <button type="button" className="bd-collapse" aria-label={collapsed ? 'Show parts' : 'Hide parts'} aria-expanded={!collapsed} onClick={() => setCollapsed(v => !v)}>
            <Icon name={collapsed ? 'arrow-up' : 'arrow-down'} size={20} />
          </button>
        )}
      </div>
      {showCards && (
        <div className="bd-cards" role="listbox" aria-label={`${CATEGORY_LABELS[category]} parts`}>
          {parts.map(def => (
            <button
              key={def.id}
              type="button"
              role="option"
              aria-selected={def.id === partId}
              aria-label={def.label}
              className={`bd-card ${def.id === partId ? 'is-selected' : ''}`}
              data-part-id={def.id}
              data-testid={`part-${def.id}`}
              onClick={() => {
                const next = def.id === partId ? null : def.id
                onPart(next)
                // On phones the 3D view needs the room while placing: keep the categories, tuck the cards away.
                if (next && layout === 'bottom')
                  setCollapsed(true)
              }}
            >
              <PartThumb def={def} size={layout === 'rail' ? 48 : 38} />
              <span className="bd-card-label">{def.label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
