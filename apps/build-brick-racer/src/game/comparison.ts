/**
 * Run comparison. Runs compare only when the challenge, physics, surfaces, power mode and assistance match.
 * Build revisions may differ; that is the point. Feedback is phrased as observations, never as a claim that
 * one part caused a change.
 */
import type { PartCatalog } from './catalog/catalog'
import type { MetricId } from './challenges/types'
import type { CarSnapshot, RunRecord } from './persistence/types'
import { catalog as shippedCatalog } from './catalog/catalog'
import { METRIC_BETTER } from './challenges/types'
import { compileVehicle } from './vehicle/compile'

export function compatible(a: RunRecord, b: RunRecord): boolean {
  return a.challengeId === b.challengeId
    && a.challengeVersion === b.challengeVersion
    && a.physicsVersion === b.physicsVersion
    && a.surfaceSignature === b.surfaceSignature
    && a.powerMode === b.powerMode
    && a.assist === b.assist
}

export function settingsSignature(s: Pick<RunRecord, 'challengeId' | 'challengeVersion' | 'physicsVersion' | 'surfaceSignature' | 'powerMode' | 'assist'>): string {
  return [s.challengeId, `v${s.challengeVersion}`, `p${s.physicsVersion}`, s.surfaceSignature, s.powerMode, s.assist].join('|')
}

export const METRIC_LABELS: Record<MetricId, string> = {
  time: 'Time',
  peakSpeed: 'Top speed',
  accelTime: 'Time to speed',
  stoppingDistance: 'Stopping distance',
  driftScore: 'Drift score',
  jumpDistance: 'Jump distance',
  progress: 'Progress',
  exitSpeed: 'Exit speed',
  entrySpeed: 'Entry speed',
  resets: 'Resets',
}

const UNIT: Record<MetricId, string> = {
  time: 's',
  peakSpeed: 'm/s',
  accelTime: 's',
  stoppingDistance: 'm',
  driftScore: 'pts',
  jumpDistance: 'm',
  progress: '%',
  exitSpeed: 'm/s',
  entrySpeed: 'm/s',
  resets: '',
}

/** Missing data reads "Not measured". */
export function formatMetric(id: MetricId, value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value))
    return 'Not measured'
  if (id === 'progress')
    return `${Math.round(value * 100)}%`
  if (id === 'resets')
    return String(Math.round(value))
  if (id === 'driftScore')
    return String(Math.round(value))
  const digits = id === 'stoppingDistance' || id === 'jumpDistance' ? 2 : 1
  return `${value.toFixed(digits)} ${UNIT[id]}`
}

export type Direction = 'better' | 'worse' | 'same' | 'info'

export interface MetricDelta {
  id: MetricId
  label: string
  current: string
  previous: string
  direction: Direction
  /** Plain-English observation, e.g. "1.3 seconds quicker". */
  phrase: string | null
}

const unitWord: Partial<Record<MetricId, [string, string, string, string]>> = {
  time: ['seconds', 'quicker', 'slower', 'second'],
  accelTime: ['seconds', 'quicker', 'slower', 'second'],
  stoppingDistance: ['metres', 'shorter', 'longer', 'metre'],
  jumpDistance: ['metres', 'further', 'shorter', 'metre'],
  driftScore: ['points', 'higher', 'lower', 'point'],
  exitSpeed: ['m/s', 'faster', 'slower', 'm/s'],
}

export function compareMetric(id: MetricId, current: number | undefined, previous: number | undefined): MetricDelta {
  const label = METRIC_LABELS[id]
  const base = { id, label, current: formatMetric(id, current), previous: formatMetric(id, previous) }
  if (current === undefined || previous === undefined)
    return { ...base, direction: 'info', phrase: null }
  const better = METRIC_BETTER[id]
  const diff = current - previous
  if (Math.abs(diff) < 1e-6)
    return { ...base, direction: 'same', phrase: 'The same' }
  const words = unitWord[id]
  const improved = better === 'lower' ? diff < 0 : better === 'higher' ? diff > 0 : null
  const direction: Direction = improved === null ? 'info' : improved ? 'better' : 'worse'
  const digits = id === 'stoppingDistance' || id === 'jumpDistance' ? 2 : 1
  const amount = Math.abs(diff).toFixed(id === 'driftScore' ? 0 : digits)
  const phrase = words ? `${amount} ${words[0]} ${improved ? words[1] : words[2]}` : null
  return { ...base, direction, phrase }
}

export interface RunComparison {
  compatible: boolean
  deltas: MetricDelta[]
  /** Observations about how the car differs between the two runs. Empty when the build is unchanged. */
  buildChanges: string[]
  buildChanged: boolean
}

/** Observations about differences between two car snapshots. */
export function describeBuildChange(a: CarSnapshot | null, b: CarSnapshot | null, catalog: PartCatalog = shippedCatalog): string[] {
  if (!a || !b || a.revisionId === b.revisionId)
    return []
  const ca = compileVehicle(a.doc, catalog)
  const cb = compileVehicle(b.doc, catalog)
  if (!ca.ok || !cb.ok)
    return ['The car was changed']
  const out: string[] = []
  const radius = (s: typeof ca.spec) => Math.max(...s.wheels.map(w => w.radius))
  const tyres = (s: typeof ca.spec) => [...new Set(s.wheels.map(w => w.tyre))].sort().join()
  if (radius(cb.spec) > radius(ca.spec) + 1e-6)
    out.push('Larger wheels')
  else if (radius(cb.spec) < radius(ca.spec) - 1e-6)
    out.push('Smaller wheels')
  else if (tyres(ca.spec) !== tyres(cb.spec))
    out.push('Different tyres')
  if (cb.spec.wheels.length !== ca.spec.wheels.length)
    out.push(`${cb.spec.wheels.length} wheels instead of ${ca.spec.wheels.length}`)
  const mass = cb.spec.mass / ca.spec.mass
  if (mass > 1.05)
    out.push('Heavier')
  else if (mass < 0.95)
    out.push('Lighter')
  const wings = (s: typeof ca.spec) => s.aero.wings.length
  if (wings(cb.spec) !== wings(ca.spec))
    out.push(wings(cb.spec) > wings(ca.spec) ? 'Added a wing' : 'Removed a wing')
  if (cb.spec.partCount !== ca.spec.partCount)
    out.push(`${Math.abs(cb.spec.partCount - ca.spec.partCount)} ${cb.spec.partCount > ca.spec.partCount ? 'more' : 'fewer'} pieces`)
  return out.length > 0 ? out : ['Pieces were rearranged']
}

export function compareRuns(
  current: RunRecord,
  previous: RunRecord | null,
  snapshots?: { current: CarSnapshot | null, previous: CarSnapshot | null },
  catalog: PartCatalog = shippedCatalog,
): RunComparison {
  if (!previous || !compatible(current, previous))
    return { compatible: false, deltas: [], buildChanges: [], buildChanged: false }
  const ids = new Set<MetricId>([...Object.keys(current.metrics), ...Object.keys(previous.metrics)] as MetricId[])
  ids.delete('progress')
  const deltas = [...ids].map(id => compareMetric(id, current.metrics[id], previous.metrics[id]))
  const buildChanged = current.carSnapshotId !== previous.carSnapshotId
  return {
    compatible: true,
    deltas,
    buildChanges: snapshots ? describeBuildChange(snapshots.previous, snapshots.current, catalog) : [],
    buildChanged,
  }
}
