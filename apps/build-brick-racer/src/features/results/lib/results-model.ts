/**
 * View-model for the Results screen. Pure, so the honesty rules are testable: an incomplete run never shows a
 * finish time, comparisons appear only for matching settings, and feedback is phrased as observations rather
 * than causes.
 */
import type { ChallengeDefinition } from '@/game/challenges/types'
import type { CarSnapshot, RunRecord } from '@/game/persistence/types'
import type { Direction } from '@/game/comparison'
import { compareRuns, METRIC_LABELS } from '@/game/comparison'
import { formatPrimary } from './format'

export type BadgeKind = 'best' | 'great' | 'finished' | 'practice' | 'tryagain' | 'ended'

export interface ResultsViewModel {
  title: string
  finished: boolean
  primary: { label: string, value: string } | null
  badge: { kind: BadgeKind, text: string, detail: string | null }
  /** A personal best that was also a great run. */
  alsoGreat: boolean
  previous: { value: string, phrase: string | null, direction: Direction } | null
  observations: string[]
  suggestion: string | null
  replay: { available: boolean, label: string }
  progressText: string | null
  incompleteReason: string | null
}

const SUGGESTIONS: Partial<Record<string, string>> = {
  garden_mud: 'Try larger wheels in the mud.',
  garden_climb: 'Try a lighter car or bigger wheels for the hill.',
  garden_jump: 'Try a faster run-up and keep the car straight.',
  kitchen_braking: 'Try wider tyres for more grip when you brake.',
  kitchen_drift: 'Try moving the heavy brick lower.',
  kitchen_sprint: 'Try making the car lighter or lower.',
  kitchen_acceleration: 'Try a lighter car for a quicker start.',
  kitchen_coast: 'Try a smoother shape so the air slips past.',
}

/** Turn a build-change note into a plain observation about the car. */
export function observe(change: string): string {
  const lower = change.charAt(0).toLowerCase() + change.slice(1)
  if (/^(larger|smaller|different) /i.test(change))
    return `This car has ${lower}`
  if (/^(heavier|lighter)$/i.test(change))
    return `This car is ${lower}`
  if (/^(added|removed) /i.test(change))
    return `This car ${lower}`
  return change
}

const incompleteTitle = (run: RunRecord): { title: string, badge: BadgeKind, text: string } =>
  ['failed', 'timeout', 'stopped'].includes(run.endReason ?? '')
    ? { title: 'TRY AGAIN', badge: 'tryagain', text: 'Try again' }
    : { title: 'RUN ENDED', badge: 'ended', text: 'Run ended' }

export function buildResultsViewModel(input: {
  run: RunRecord
  def: ChallengeDefinition
  previous: RunRecord | null
  snapshots?: { current: CarSnapshot | null, previous: CarSnapshot | null }
}): ResultsViewModel {
  const { run, def } = input
  const replay = run.replayRef ? { available: true, label: 'Watch replay' } : { available: false, label: 'Replay unavailable' }
  const finished = run.status === 'finished'

  if (!finished) {
    const t = incompleteTitle(run)
    const drift = run.metrics.driftScore
    const progressText = run.progress > 0 ? `Furthest: ${Math.round(run.progress * 100)}%` : null
    return {
      title: t.title,
      finished: false,
      // Partial measurements are real; a finish time is never shown for an unfinished run.
      primary: drift !== undefined && drift > 0
        ? { label: 'Drift score so far', value: String(Math.round(drift)) }
        : progressText ? { label: 'Progress', value: `${Math.round(run.progress * 100)}%` } : null,
      badge: { kind: t.badge, text: t.text, detail: null },
      alsoGreat: false,
      previous: null,
      observations: [],
      suggestion: SUGGESTIONS[def.id] ?? null,
      replay,
      progressText,
      incompleteReason: run.message,
    }
  }

  const value = run.metrics[def.metrics.primary]
  let kind: BadgeKind = run.completion === 'great' ? 'great' : 'finished'
  let text = kind === 'great' ? 'Great run' : 'Finished'
  let detail: string | null = null
  if (!run.eligible) {
    kind = 'practice'
    text = 'Practice run'
    detail = run.invalidReasons[0] ?? 'This attempt does not count for your best.'
  }
  else if (run.wasBest) {
    kind = 'best'
    text = 'Personal best'
  }

  const comparison = compareRuns(run, input.previous, input.snapshots)
  const delta = comparison.compatible ? comparison.deltas.find(d => d.id === def.metrics.primary) : undefined
  return {
    title: `${def.shortName.toUpperCase()} COMPLETE`,
    finished: true,
    primary: { label: METRIC_LABELS[def.metrics.primary], value: formatPrimary(def, value) },
    badge: { kind, text, detail },
    alsoGreat: kind === 'best' && run.completion === 'great',
    previous: input.previous && comparison.compatible
      ? { value: delta ? formatPrimary(def, input.previous.metrics[def.metrics.primary]) : 'Not measured', phrase: delta?.phrase ?? null, direction: delta?.direction ?? 'info' }
      : null,
    observations: comparison.buildChanges.map(observe),
    suggestion: run.completion === 'great' && kind !== 'practice' ? null : (SUGGESTIONS[def.id] ?? null),
    replay,
    progressText: null,
    incompleteReason: null,
  }
}
