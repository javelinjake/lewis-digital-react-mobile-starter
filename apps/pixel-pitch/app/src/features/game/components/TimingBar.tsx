import type { Bar } from '@ld/pixel-pitch-core'
import type { RefObject } from 'react'
import { markerAt, targetAt } from '@ld/pixel-pitch-core'
import { useEffect, useMemo, useRef } from 'react'
import { art } from '../lib/art'

export interface Zone {
  /** Half the zone's width, as a fraction of the bar. A narrow round shrinks every zone (`bar.zone`). */
  halfWidth: number
  colour: string
  label: string
}

/** The ball's four turns, from the asset pack. */
const BALL_FRAMES = [0, 1, 2, 3].map(frame => `pitch/ball_${frame}.png`)
/** How far along the bar (as a fraction of it) the ball rolls for each turn of a frame. */
const ROLL_STEP = 0.025

/**
 * Rolls a ball along the bar in time with `markerAt`, and moves a moving target in time with `targetAt`: the same
 * functions the server scores with. The ball's frame comes from where it is, so it turns forwards going right and
 * backwards coming back, and stops turning when it stops. Stopped, both stay where they were.
 */
function useBarFrame(bar: Bar, running: boolean, startedAt: RefObject<number>) {
  const ball = useRef<HTMLDivElement>(null)
  const frames = useRef<Array<HTMLImageElement | null>>([])
  const target = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!running)
      return
    const paint = () => {
      const ms = performance.now() - startedAt.current
      const at = markerAt(bar, ms)
      if (ball.current)
        ball.current.style.left = `${at * 100}%`
      const shown = ((Math.floor(at / ROLL_STEP) % 4) + 4) % 4
      for (const [index, frame] of frames.current.entries()) {
        if (frame)
          frame.style.visibility = index === shown ? 'visible' : 'hidden'
      }
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
  return { ball, frames, target }
}

/** A bar with a rolling ball and a target, wider zones first. The target may swing, and may be smaller. */
export function TimingBar({ bar, running, startedAt, zones }: { bar: Bar, running: boolean, startedAt: RefObject<number>, zones: readonly Zone[] }) {
  const { ball, frames, target } = useBarFrame(bar, running, startedAt)
  const urls = useMemo(() => BALL_FRAMES.map(path => art(path)), [])
  return (
    <div className="relative w-full px-4" role="img" aria-label={`Timing bar with a rolling ball. The target is ${zones.map(zone => zone.label).join(', ')}.`}>
      <div className="relative h-12 w-full overflow-hidden border-2 border-slate bg-base-300">
        {/* A full-width layer shifted to where the target is, so the zones inside stay centred on it. */}
        <div ref={target} className="absolute inset-0" style={{ transform: `translateX(${(targetAt(bar, 0) - 0.5) * 100}%)` }}>
          {zones.map(zone => (
            <div key={zone.label} className="absolute inset-y-0" style={{ left: `${(0.5 - zone.halfWidth * bar.zone) * 100}%`, width: `${zone.halfWidth * bar.zone * 200}%`, background: zone.colour }} />
          ))}
        </div>
        {/* The touchline painted along the bar, for the ball to roll on. */}
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/25" />
      </div>
      {/* The ball rides in a layer as wide as the bar, so 0 and 1 are its two ends; it may hang over them by half. */}
      <div className="pointer-events-none absolute inset-y-0 right-4 left-4">
        <div ref={ball} className="absolute top-1/2 size-8 -translate-x-1/2 -translate-y-1/2" style={{ left: `${markerAt(bar, 0) * 100}%` }}>
          <div className="absolute -bottom-1 left-1/2 h-1.5 w-6 -translate-x-1/2 bg-black/35" />
          {urls.map((url, index) => (
            <img
              key={url}
              ref={(element) => {
                frames.current[index] = element
              }}
              src={url}
              alt=""
              className="pixel absolute inset-0 size-8"
              style={{ visibility: index === 0 ? 'visible' : 'hidden' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
