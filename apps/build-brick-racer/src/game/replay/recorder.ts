import type { VehicleState } from '../vehicle/sim'
import type { ReplayEvent, ReplayRecord } from './types'
import { REPLAY_SAMPLE_HZ, REPLAY_SCHEMA_VERSION } from './types'

/** Captures transforms and wheel poses at ~15 Hz, with extra samples around impacts and resets. */
export class ReplayRecorder {
  private readonly data: number[] = []
  private readonly breaks: number[] = []
  private readonly events: ReplayEvent[] = []
  private lastT = -Infinity
  private count = 0
  private readonly stride: number

  constructor(private readonly wheelCount: number) {
    this.stride = 8 + wheelCount * 3
  }

  /** Record a sample if due, or `force` it (impacts, resets, finish). */
  capture(t: number, s: VehicleState, force = false): void {
    if (!force && t - this.lastT < 1 / REPLAY_SAMPLE_HZ - 1e-6)
      return
    this.lastT = t
    this.data.push(t, s.pos[0], s.pos[1], s.pos[2], s.quat[0], s.quat[1], s.quat[2], s.quat[3])
    for (let i = 0; i < this.wheelCount; i++) {
      const w = s.wheels[i]
      this.data.push(w?.steer ?? 0, w?.spin ?? 0, w?.offset ?? 0)
    }
    this.count += 1
  }

  event(e: ReplayEvent): void {
    this.events.push(e)
  }

  /** Mark that the next sample follows a teleport. */
  markBreak(): void {
    this.breaks.push(this.count)
  }

  finish(runId: string, carSnapshotId: string, challengeId: string | null, duration: number, pinned = false): ReplayRecord {
    const samples = new Float32Array(this.data)
    return {
      schemaVersion: REPLAY_SCHEMA_VERSION,
      runId,
      carSnapshotId,
      challengeId,
      sampleHz: REPLAY_SAMPLE_HZ,
      wheelCount: this.wheelCount,
      stride: this.stride,
      samples,
      breaks: [...this.breaks],
      events: [...this.events],
      duration,
      sizeBytes: samples.byteLength + this.events.length * 64,
      pinned,
      createdAt: new Date().toISOString(),
    }
  }
}
