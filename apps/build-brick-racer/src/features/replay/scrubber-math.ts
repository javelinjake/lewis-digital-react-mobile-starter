import type { ReplayEvent, ReplayEventType } from '@/game/replay/types'

/** Pure maths for the replay scrubber and clock. */
export const SCRUB_STEPS = 1000

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))

export const timeToFraction = (t: number, duration: number): number => (duration > 0 ? clamp01(t / duration) : 0)

export const fractionToTime = (f: number, duration: number): number => clamp01(f) * Math.max(0, duration)

/** Slider position 0..SCRUB_STEPS to time in seconds. */
export const sliderToTime = (value: number, duration: number): number => fractionToTime(value / SCRUB_STEPS, duration)

export const timeToSlider = (t: number, duration: number): number => Math.round(timeToFraction(t, duration) * SCRUB_STEPS)

export const formatClock = (seconds: number): string => {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}

export const formatPercent = (t: number, duration: number): string => `${Math.round(timeToFraction(t, duration) * 100)}%`

export interface Tick {
  /** Position along the scrubber, 0..100. */
  left: number
  type: ReplayEventType
  label: string
}

const SHOWN: Partial<Record<ReplayEventType, string>> = {
  gate: 'Checkpoint',
  impact: 'Crash',
  wall: 'Wall hit',
  reset: 'Reset',
  finish: 'Finish',
  airborne: 'Jump',
}

/** Event markers for the scrubber. Quick repeats of the same event type are merged to keep it readable. */
export function eventTicks(events: readonly ReplayEvent[], duration: number): Tick[] {
  const out: Tick[] = []
  const lastByType = new Map<ReplayEventType, number>()
  for (const e of events) {
    const label = SHOWN[e.type]
    if (!label)
      continue
    const prev = lastByType.get(e.type)
    if (prev !== undefined && e.t - prev < 0.6)
      continue
    lastByType.set(e.type, e.t)
    out.push({ left: timeToFraction(e.t, duration) * 100, type: e.type, label })
  }
  return out
}

/** Advance playback time by a frame at a speed, stopping at the end. */
export function advanceTime(t: number, dt: number, speed: number, duration: number): { t: number, ended: boolean } {
  const next = t + dt * speed
  return next >= duration ? { t: duration, ended: true } : { t: Math.max(0, next), ended: false }
}
