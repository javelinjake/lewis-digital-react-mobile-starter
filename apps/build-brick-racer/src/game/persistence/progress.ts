import type { RunOutcome } from '../challenges/eval'
import type { ChallengeDefinition } from '../challenges/types'
import type { ProgressRecord } from './types'
import { METRIC_BETTER } from '../challenges/types'

export function emptyProgress(signature: string, challengeId: ProgressRecord['challengeId']): ProgressRecord {
  return {
    signature,
    challengeId,
    bestRunId: null,
    bestValue: null,
    completed: false,
    great: false,
    lastAttemptId: null,
    attempts: 0,
    maxProgress: 0,
  }
}

export function isBetter(def: ChallengeDefinition, candidate: number, best: number): boolean {
  const better = METRIC_BETTER[def.metrics.primary]
  return better === 'higher' ? candidate > best : better === 'lower' ? candidate < best : false
}

/**
 * Apply one finished attempt to a progress record. Deterministic and idempotent for a given run id,
 * so a retried save after an interruption never double counts.
 */
export function applyRun(
  prev: ProgressRecord,
  run: { id: string, outcome: Pick<RunOutcome, 'status' | 'eligible' | 'completion' | 'metrics' | 'progress'> },
  def: ChallengeDefinition,
): { progress: ProgressRecord, wasBest: boolean } {
  if (prev.lastAttemptId === run.id)
    return { progress: prev, wasBest: prev.bestRunId === run.id }
  const next: ProgressRecord = {
    ...prev,
    attempts: prev.attempts + 1,
    lastAttemptId: run.id,
    maxProgress: Math.max(prev.maxProgress, run.outcome.progress),
  }
  let wasBest = false
  if (run.outcome.status === 'finished') {
    next.completed = true
    if (run.outcome.completion === 'great')
      next.great = true
    const value = run.outcome.metrics[def.metrics.primary]
    if (run.outcome.eligible && value !== undefined && Number.isFinite(value)) {
      if (prev.bestValue === null || isBetter(def, value, prev.bestValue)) {
        next.bestRunId = run.id
        next.bestValue = value
        wasBest = true
      }
    }
  }
  return { progress: next, wasBest }
}
