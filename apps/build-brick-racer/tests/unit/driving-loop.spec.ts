import { describe, expect, it } from 'vitest'
import { FixedStepper } from '@/features/driving/loop/fixed-step'

function simulate(fps: number, seconds: number): number {
  const s = new FixedStepper(1 / 60)
  let ticks = 0
  const frame = 1 / fps
  for (let t = 0; t < seconds; t += frame) ticks += s.advance(frame, () => {})
  return ticks
}

describe('fixed timestep (render-rate independence)', () => {
  it('runs the same number of physics ticks at 30, 60, 90 and 144 fps', () => {
    for (const fps of [30, 60, 90, 144]) {
      const ticks = simulate(fps, 10)
      expect(Math.abs(ticks - 600), `${fps} fps`).toBeLessThanOrEqual(2)
    }
  })

  it('exposes a 0..1 interpolation alpha between ticks', () => {
    const s = new FixedStepper(1 / 60)
    s.advance(1 / 120, () => {})
    expect(s.alpha).toBeCloseTo(0.5, 5)
    s.advance(1 / 120, () => {})
    expect(s.alpha).toBeLessThan(0.01)
  })

  it('caps catch-up after a long stall instead of spiralling', () => {
    const s = new FixedStepper(1 / 60, 5, 0.1)
    let ticks = 0
    ticks += s.advance(2, () => {})
    expect(ticks).toBeLessThanOrEqual(5)
    ticks = s.advance(1 / 60, () => {})
    expect(ticks).toBeLessThanOrEqual(2)
  })

  it('reset drops any leftover time', () => {
    const s = new FixedStepper(1 / 60)
    s.advance(0.012, () => {})
    s.reset()
    expect(s.alpha).toBe(0)
  })
})
