import type { EndReason, RunState } from './rules/types'
import type { ChallengeDefinition, CompletionLevel, MetricId, RunStatus } from './types'
import { METRIC_BETTER } from './types'

/** Everything persisted about one attempt, apart from the car snapshot and replay. */
export interface RunOutcome {
  challengeId: string
  challengeVersion: number
  status: RunStatus
  endReason: EndReason | null
  metrics: Partial<Record<MetricId, number>>
  /** Eligible for personal best and comparisons: continuous attempt, no rule violations. */
  eligible: boolean
  invalidReasons: string[]
  /** `finished` or `great` for a finished run, null otherwise. Personal best is decided against saved progress. */
  completion: Exclude<CompletionLevel, 'best'> | null
  /** Furthest route progress, 0..1. Stays visible after an abandoned attempt. */
  progress: number
  resets: number
  elapsed: number
  message: string | null
}

/** Whether a primary value beats the authored "Great run" threshold. Independent of personal best. */
export function isGreat(def: ChallengeDefinition, value: number | undefined): boolean {
  if (value === undefined || !Number.isFinite(value))
    return false
  const better = METRIC_BETTER[def.metrics.primary]
  if (better === 'lower')
    return value <= def.thresholds.great
  if (better === 'higher')
    return value >= def.thresholds.great
  return false
}

export function evaluateRun(def: ChallengeDefinition, run: RunState): RunOutcome {
  const finished = run.phase === 'finished'
  const primary = run.metrics[def.metrics.primary]
  const metrics = { ...run.metrics }
  // Never invent a finish time or a measurement that needs a valid finish. Partial progress and a
  // partial drift score are real recorded values and stay visible.
  if (!finished) {
    delete metrics.time
    delete metrics.accelTime
    delete metrics.stoppingDistance
    delete metrics.exitSpeed
    delete metrics.jumpDistance
  }
  const status: RunStatus = finished ? 'finished' : run.endReason === 'abandoned' ? 'abandoned' : 'ended'
  return {
    challengeId: def.id,
    challengeVersion: def.version,
    status,
    endReason: run.endReason,
    metrics: { ...metrics, progress: run.progress },
    eligible: finished && run.invalid.size === 0,
    invalidReasons: [...run.invalid],
    completion: finished ? (isGreat(def, primary) ? 'great' : 'finished') : null,
    progress: run.progress,
    resets: run.resets,
    elapsed: run.t,
    message: run.message,
  }
}
