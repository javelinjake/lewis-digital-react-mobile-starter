/**
 * Runs game logic at a steady rate whatever the screen's frame rate is, so a match replay plays at the same speed on
 * a 60 Hz and a 120 Hz phone, and a slow frame cannot make it jump. Rendering uses `alpha` to blend between steps.
 */
export interface FixedStep {
  /** Feed the time since the last frame. Calls `update` once per elapsed step. Returns progress into the next step, 0 to 1. */
  advance: (deltaMs: number, update: (stepMs: number) => void) => number
  reset: () => void
}

export function createFixedStep(stepMs: number, maxStepsPerFrame = 5): FixedStep {
  if (!(stepMs > 0))
    throw new Error('stepMs must be positive.')
  let accumulator = 0

  return {
    advance(deltaMs, update) {
      accumulator += Math.max(0, deltaMs)
      let steps = 0
      while (accumulator >= stepMs && steps < maxStepsPerFrame) {
        update(stepMs)
        accumulator -= stepMs
        steps++
      }
      // Far behind (the tab was frozen): drop the backlog instead of fast-forwarding through it.
      if (steps === maxStepsPerFrame)
        accumulator = accumulator % stepMs
      return accumulator / stepMs
    },
    reset() {
      accumulator = 0
    },
  }
}
