import type { Q4, V3 } from '../math'
import type { ReplayRecord } from './types'
import { lerp, lerp3, qSlerp } from '../math'

export interface ReplayFrame {
  pos: V3
  quat: Q4
  wheels: Array<{ steer: number, spin: number, offset: number }>
  /** Seconds into the run. */
  t: number
}

/** Interpolating playback of a recorded run. */
export class ReplayPlayer {
  private readonly count: number
  private readonly breaks: Set<number>

  constructor(readonly record: ReplayRecord) {
    this.count = Math.floor(record.samples.length / record.stride)
    this.breaks = new Set(record.breaks)
  }

  get duration(): number {
    return this.record.duration
  }

  get frames(): number {
    return this.count
  }

  private timeAt(i: number): number {
    return this.record.samples[i * this.record.stride]!
  }

  private read(i: number): ReplayFrame {
    const s = this.record.samples
    const o = i * this.record.stride
    const wheels: ReplayFrame['wheels'] = []
    for (let w = 0; w < this.record.wheelCount; w++) {
      const b = o + 8 + w * 3
      wheels.push({ steer: s[b]!, spin: s[b + 1]!, offset: s[b + 2]! })
    }
    return { t: s[o]!, pos: [s[o + 1]!, s[o + 2]!, s[o + 3]!], quat: [s[o + 4]!, s[o + 5]!, s[o + 6]!, s[o + 7]!], wheels }
  }

  /** State at `t` seconds, interpolated, clamped to the recording. Null when nothing was recorded. */
  at(t: number): ReplayFrame | null {
    if (this.count === 0)
      return null
    if (t <= this.timeAt(0))
      return this.read(0)
    if (t >= this.timeAt(this.count - 1))
      return this.read(this.count - 1)
    let lo = 0
    let hi = this.count - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (this.timeAt(mid) <= t)
        lo = mid
      else
        hi = mid
    }
    const a = this.read(lo)
    if (this.breaks.has(hi))
      return a
    const b = this.read(hi)
    const span = b.t - a.t || 1
    const f = (t - a.t) / span
    return {
      t,
      pos: lerp3(a.pos, b.pos, f),
      quat: qSlerp(a.quat, b.quat, f),
      wheels: a.wheels.map((w, i) => ({
        steer: lerp(w.steer, b.wheels[i]!.steer, f),
        spin: lerp(w.spin, b.wheels[i]!.spin, f),
        offset: lerp(w.offset, b.wheels[i]!.offset, f),
      })),
    }
  }
}
