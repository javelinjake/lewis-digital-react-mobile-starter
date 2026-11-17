export const REPLAY_SCHEMA_VERSION = 1
export const REPLAY_SAMPLE_HZ = 15

export type ReplayEventType = 'gate' | 'impact' | 'wall' | 'reset' | 'airborne' | 'land' | 'splash' | 'finish' | 'start'

export interface ReplayEvent {
  t: number
  type: ReplayEventType
  /** Magnitude for impacts, gate index for gates. */
  value?: number
  /** World position of the event, for camera hints. */
  pos?: [number, number, number]
}

/**
 * Recorded state of the actual run, used for playback so it matches what the player did even if
 * the physics could not be reproduced exactly on another device.
 */
export interface ReplayRecord {
  schemaVersion: number
  runId: string
  carSnapshotId: string
  challengeId: string | null
  sampleHz: number
  wheelCount: number
  /** Floats per sample: t, pos(3), quat(4), then steer, spin, offset per wheel. */
  stride: number
  samples: Float32Array
  /** Sample indexes where the car was teleported (reset): do not interpolate across them. */
  breaks: number[]
  events: ReplayEvent[]
  duration: number
  sizeBytes: number
  /** Personal-best replays are pinned and evicted last. */
  pinned: boolean
  createdAt: string
}
