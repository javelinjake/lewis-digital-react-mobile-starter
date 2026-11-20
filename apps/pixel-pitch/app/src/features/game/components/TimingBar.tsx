import type { Bar } from '@ld/pixel-pitch-core'
import type { RefObject } from 'react'
import { markerAt } from '@ld/pixel-pitch-core'
import { useEffect, useRef } from 'react'
import { art } from '../lib/art'

export interface Zone {
  /** Half the zone's width, as a fraction of the bar. */
  halfWidth: number
  colour: string
  label: string
}

/** Moves a marker along the bar in time with `markerAt`, the same function the server scores with. */
function useMarker(bar: Bar, running: boolean, startedAt: RefObject<number>) {
  const marker = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (!running)
      return
    let frame = 0
    const tick = () => {
      if (marker.current)
        marker.current.style.left = `${markerAt(bar, performance.now() - startedAt.current) * 100}%`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [bar, running, startedAt])
  return marker
}

/** A bar with a bouncing marker and a target, wider zones first. Stopped, the marker stays where it was. */
export function TimingBar({ bar, running, startedAt, zones }: { bar: Bar, running: boolean, startedAt: RefObject<number>, zones: readonly Zone[] }) {
  const marker = useMarker(bar, running, startedAt)
  return (
    <div className="relative h-12 w-full border-2 border-slate bg-base-300" role="img" aria-label={`Timing bar. The target is ${zones.map(zone => zone.label).join(', ')}.`}>
      {zones.map(zone => (
        <div key={zone.label} className="absolute inset-y-0" style={{ left: `${(bar.centre - zone.halfWidth) * 100}%`, width: `${zone.halfWidth * 200}%`, background: zone.colour }} />
      ))}
      <img ref={marker} src={art('ui/timing_marker.png')} alt="" className="pixel absolute -top-2 h-16 w-3 -translate-x-1/2" style={{ left: '0%' }} />
    </div>
  )
}
