import type { Bar } from '@ld/pixel-pitch-core'
import type { RefObject } from 'react'
import { markerAt, targetAt } from '@ld/pixel-pitch-core'
import { useEffect, useRef } from 'react'
import { art } from '../lib/art'

export interface Zone {
  /** Half the zone's width, as a fraction of the bar. A narrow round shrinks every zone (`bar.zone`). */
  halfWidth: number
  colour: string
  label: string
}

/**
 * Moves a marker along the bar in time with `markerAt`, and a moving target in time with `targetAt`: the same
 * functions the server scores with. Stopped, both stay where they were.
 */
function useBarFrame(bar: Bar, running: boolean, startedAt: RefObject<number>) {
  const marker = useRef<HTMLImageElement>(null)
  const target = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!running)
      return
    const paint = () => {
      const ms = performance.now() - startedAt.current
      if (marker.current)
        marker.current.style.left = `${markerAt(bar, ms) * 100}%`
      if (target.current)
        target.current.style.transform = `translateX(${(targetAt(bar, ms) - 0.5) * 100}%)`
    }
    let frame = 0
    const tick = () => {
      paint()
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [bar, running, startedAt])
  return { marker, target }
}

/** A bar with a bouncing marker and a target, wider zones first. The target may swing, and may be smaller. */
export function TimingBar({ bar, running, startedAt, zones }: { bar: Bar, running: boolean, startedAt: RefObject<number>, zones: readonly Zone[] }) {
  const { marker, target } = useBarFrame(bar, running, startedAt)
  return (
    <div className="relative h-12 w-full overflow-hidden border-2 border-slate bg-base-300" role="img" aria-label={`Timing bar. The target is ${zones.map(zone => zone.label).join(', ')}.`}>
      {/* A full-width layer shifted to where the target is, so the zones inside stay centred on it. */}
      <div ref={target} className="absolute inset-0" style={{ transform: `translateX(${(targetAt(bar, 0) - 0.5) * 100}%)` }}>
        {zones.map(zone => (
          <div key={zone.label} className="absolute inset-y-0" style={{ left: `${(0.5 - zone.halfWidth * bar.zone) * 100}%`, width: `${zone.halfWidth * bar.zone * 200}%`, background: zone.colour }} />
        ))}
      </div>
      <img ref={marker} src={art('ui/timing_marker.png')} alt="" className="pixel absolute -top-2 h-16 w-3 -translate-x-1/2" style={{ left: '0%' }} />
    </div>
  )
}
