import type { ReactNode } from 'react'
import type { ControlHub } from '../input/hub'
import type { PadId } from '../input/touch-controls'
import { useEffect, useRef } from 'react'
import { Icon } from '@/components/ui/Icon'
import { layoutFor } from '../input/touch-controls'

interface ControlsProps {
  hub: ControlHub
  leftHanded: boolean
  scale: number
  /** Gravity challenges have no throttle: only the brake is shown. */
  powered: boolean
  enabled: boolean
}

/**
 * On-screen controls. Every pad is owned by the pointer that pressed it (pointer capture), so steering,
 * throttle and brake can be held by different fingers at the same time. The visual pressed state is written
 * straight to the DOM from the hub, so feedback lands on the next rendered frame.
 */
export function Controls({ hub, leftHanded, scale, powered, enabled }: ControlsProps) {
  const refs = useRef(new Map<PadId, HTMLButtonElement>())
  const layout = layoutFor(leftHanded)

  useEffect(() => hub.touch.onChange((pad, down) => {
    refs.current.get(pad)?.classList.toggle('is-down', down)
    refs.current.get(pad)?.setAttribute('aria-pressed', String(down))
  }), [hub])

  const bind = (pad: PadId) => ({
    ref: (el: HTMLButtonElement | null) => {
      if (el)
        refs.current.set(pad, el)
      else
        refs.current.delete(pad)
    },
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!enabled)
        return
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }
      catch {
        // Capture can be refused (for example a synthetic pointer); the press is still tracked by pointer id.
      }
      hub.touch.press(pad, e.pointerId)
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      hub.touch.release(e.pointerId)
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      hub.touch.release(e.pointerId)
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      hub.touch.release(e.pointerId)
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })

  const steer: ReactNode = (
    <div className="dr-cluster dr-steer" data-testid="steer-cluster">
      <button type="button" className="br-pad dr-pad dr-pad-steer" aria-label="Steer left" data-testid="pad-left" {...bind('left')}>
        <Icon name="arrow-left" size={44} />
      </button>
      <button type="button" className="br-pad dr-pad dr-pad-steer" aria-label="Steer right" data-testid="pad-right" {...bind('right')}>
        <Icon name="arrow-right" size={44} />
      </button>
    </div>
  )

  const pedals: ReactNode = (
    <div className="dr-cluster dr-pedals" data-testid="pedal-cluster">
      {powered && (
        <button type="button" className="br-pad is-throttle dr-pad dr-pad-gas" aria-label="Throttle" data-hud="throttle" data-testid="pad-throttle" {...bind('throttle')}>
          <Icon name="arrow-up" size={36} />
          <span>Go</span>
        </button>
      )}
      <div className="dr-pedal-stack">
        <button type="button" className="br-pad is-brake dr-pad dr-pad-brake" aria-label="Brake" data-testid="pad-brake" {...bind('brake')}>
          <span>Brake</span>
        </button>
        {powered && (
          <button type="button" className="br-pad dr-pad dr-pad-rev" aria-label="Reverse" aria-pressed="false" data-testid="pad-reverse" {...bind('reverse')}>
            <span>R</span>
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div
      className={`dr-controls ${layout.steer === 'right' ? 'is-mirrored' : ''} ${enabled ? '' : 'is-disabled'}`}
      style={{ '--ctl-scale': scale } as React.CSSProperties}
      data-testid="controls"
      data-left-handed={leftHanded}
    >
      {steer}
      {pedals}
    </div>
  )
}
