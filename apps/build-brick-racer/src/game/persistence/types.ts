import type { CarDocument } from '../build/types'
import type { ChallengeId, CompletionLevel, MetricId, PowerMode, RunStatus } from '../challenges/types'
import type { AssistMode } from '../vehicle/physics-config'

export type BuildMode = 'easy' | 'free'
export type CameraChoice = 'chase' | 'close' | 'high' | 'smart'

export const PREFERENCES_SCHEMA_VERSION = 1

export interface PlayerPreferences {
  schemaVersion: number
  buildMode: BuildMode
  controls: { leftHanded: boolean, scale: number }
  camera: CameraChoice
  cameraLock: boolean
  assist: AssistMode
  audio: { music: number, effects: number, muted: boolean }
  reducedMotion: boolean
  vibration: boolean
  tutorial: { completed: string[], dismissed: boolean }
  lastCarId: string | null
}

export const DEFAULT_PREFERENCES: PlayerPreferences = {
  schemaVersion: PREFERENCES_SCHEMA_VERSION,
  buildMode: 'easy',
  controls: { leftHanded: false, scale: 1 },
  camera: 'chase',
  cameraLock: false,
  assist: 'light',
  audio: { music: 0.5, effects: 0.7, muted: false },
  reducedMotion: false,
  vibration: true,
  tutorial: { completed: [], dismissed: false },
  lastCarId: null,
}

/** Immutable copy of the car used for a recorded run. Later edits never change it. */
export interface CarSnapshot {
  id: string
  carId: string
  revisionId: string
  createdAt: string
  doc: CarDocument
}

/** Everything that decides whether two runs may be compared. */
export interface ComparableSettings {
  challengeId: ChallengeId
  challengeVersion: number
  physicsVersion: number
  surfaceSignature: string
  powerMode: PowerMode
  assist: AssistMode
}

export interface RunRecord extends ComparableSettings {
  id: string
  carId: string
  carName: string
  carSnapshotId: string
  environmentVersion: number
  controls: { leftHanded: boolean, scale: number }
  camera: CameraChoice
  /** Stable key of ComparableSettings. Personal bests are tracked per signature. */
  signature: string
  startedAt: string
  endedAt: string
  status: RunStatus
  endReason: string | null
  metrics: Partial<Record<MetricId, number>>
  eligible: boolean
  invalidReasons: string[]
  completion: Exclude<CompletionLevel, 'best'> | null
  /** True when this run set the personal best for its signature at the time it was recorded. */
  wasBest: boolean
  progress: number
  resets: number
  message: string | null
  /** Null once the replay is unavailable (never recorded, failed to save or evicted). */
  replayRef: string | null
}

export interface ProgressRecord {
  signature: string
  challengeId: ChallengeId
  bestRunId: string | null
  bestValue: number | null
  completed: boolean
  great: boolean
  lastAttemptId: string | null
  attempts: number
  /** Furthest route progress ever reached, kept after abandoned attempts. */
  maxProgress: number
}

export interface SaveOutcome {
  ok: boolean
  /** Set when storage is full or unavailable. The in-memory edit is kept and the player can retry. */
  error?: 'storage_full' | 'storage_error'
}

/** A run that was in progress when the app was closed or killed. */
export interface InterruptedAttempt {
  carId: string
  challengeId: string | null
  startedAt: string
}
