import type { ReplayEvent } from '@/game/replay/types'
import { describe, expect, it } from 'vitest'
import { advanceTime, eventTicks, formatClock, formatPercent, fractionToTime, SCRUB_STEPS, sliderToTime, timeToFraction, timeToSlider } from '@/features/replay/scrubber-math'

describe('replay scrubber maths', () => {
  it('converts between time, fraction and slider position', () => {
    expect(timeToFraction(12.4, 21.8)).toBeCloseTo(0.5688, 3)
    expect(formatPercent(12.4, 21.8)).toBe('57%')
    expect(fractionToTime(0.5, 20)).toBe(10)
    expect(sliderToTime(SCRUB_STEPS, 20)).toBe(20)
    expect(timeToSlider(10, 20)).toBe(SCRUB_STEPS / 2)
    expect(timeToFraction(5, 0)).toBe(0)
    expect(timeToFraction(99, 10)).toBe(1)
    expect(timeToFraction(Number.NaN, 10)).toBe(0)
  })

  it('formats the clock like the design', () => {
    expect(formatClock(12.4)).toBe('00:12.4')
    expect(formatClock(21.8)).toBe('00:21.8')
    expect(formatClock(-1)).toBe('00:00.0')
  })

  it('advances at 0.5x and 1x, stopping at the end', () => {
    expect(advanceTime(1, 0.5, 1, 10)).toEqual({ t: 1.5, ended: false })
    expect(advanceTime(1, 0.5, 0.5, 10)).toEqual({ t: 1.25, ended: false })
    expect(advanceTime(9.9, 0.5, 1, 10)).toEqual({ t: 10, ended: true })
  })

  it('shows markers for gates, impacts, resets, jumps and the finish, merging quick repeats', () => {
    const events: ReplayEvent[] = [
      { t: 0, type: 'start' },
      { t: 3, type: 'gate', value: 1 },
      { t: 6, type: 'impact', value: 3 },
      { t: 6.2, type: 'impact', value: 2 },
      { t: 8, type: 'reset' },
      { t: 10, type: 'finish' },
    ]
    const ticks = eventTicks(events, 10)
    expect(ticks.map(t => t.type)).toEqual(['gate', 'impact', 'reset', 'finish'])
    expect(ticks[0]!.left).toBeCloseTo(30)
    expect(ticks[3]!.left).toBeCloseTo(100)
  })
})
