import { type RefObject, useEffect, useRef } from 'react'
import { createFixedStep } from './fixed-step'

export interface CanvasLoopOptions {
  /** Logic step in ms. 1000 / 60 by default. */
  stepMs?: number
  /** Cap on drawing, e.g. 30 in low-effects mode. Logic still runs at `stepMs`. */
  maxFps?: number
  paused?: boolean
  update: (stepMs: number) => void
  /** `alpha` is how far (0 to 1) the frame is between the last and next logic step. */
  render: (context: CanvasRenderingContext2D, alpha: number) => void
}

/**
 * Drives a canvas: fixed-step logic, capped drawing, and a loop that stops while the page is hidden so a backgrounded
 * game costs no battery. Callbacks may change every render without restarting the loop.
 */
export function useCanvasLoop(canvasRef: RefObject<HTMLCanvasElement | null>, options: CanvasLoopOptions) {
  const latest = useRef(options)
  latest.current = options
  const { paused = false, stepMs = 1000 / 60, maxFps } = options

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || paused)
      return

    const step = createFixedStep(stepMs)
    const minFrameMs = maxFps ? 1000 / maxFps : 0
    let frame = 0
    let last = 0
    let lastDrawn = 0

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = last ? now - last : 0
      last = now
      const alpha = step.advance(delta, ms => latest.current.update(ms))
      if (now - lastDrawn < minFrameMs - 1)
        return
      lastDrawn = now
      context.imageSmoothingEnabled = false
      latest.current.render(context, alpha)
    }

    const onVisibility = () => {
      cancelAnimationFrame(frame)
      if (document.hidden)
        return
      // Coming back: start from a clean clock, so the time spent away is not replayed as a burst of logic.
      last = 0
      step.reset()
      frame = requestAnimationFrame(tick)
    }

    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden)
      frame = requestAnimationFrame(tick)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(frame)
    }
  }, [canvasRef, paused, stepMs, maxFps])
}
