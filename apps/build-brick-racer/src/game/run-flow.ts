/**
 * Turns a finished (or ended) attempt into saved records: the car snapshot, the run with its settings
 * signature, the personal-best update and the replay. A replay problem never loses the metrics.
 */
import type { CarDocument } from './build/types'
import type { ChallengeRun } from './challenges/run'
import type { ChallengeDefinition } from './challenges/types'
import type { GameRepo } from './persistence/repo'
import type { CameraChoice, ProgressRecord, RunRecord } from './persistence/types'
import type { DriveSession } from './session'
import type { AssistMode } from './vehicle/physics-config'
import { makeId } from './build/doc'
import { evaluateRun } from './challenges/eval'
import { settingsSignature } from './comparison'
import { PHYSICS_VERSION, SURFACE_SIGNATURE } from './vehicle/physics-config'

export interface RecordRunInput {
  repo: GameRepo
  doc: CarDocument
  def: ChallengeDefinition
  session: DriveSession
  run: ChallengeRun
  assist: AssistMode
  camera: CameraChoice
  controls: { leftHanded: boolean, scale: number }
  startedAt: string
  replayBudgetBytes: number
  /** Supplied for retries so a repeated save never duplicates the run. */
  runId?: string
}

export async function recordRun(input: RecordRunInput): Promise<{ run: RunRecord, progress: ProgressRecord, previous: RunRecord | null }> {
  const { repo, doc, def, session, run } = input
  const outcome = evaluateRun(def, run.run)
  const runId = input.runId ?? makeId()
  const snapshotId = await repo.saveSnapshot(doc)

  const comparable = {
    challengeId: def.id,
    challengeVersion: def.version,
    physicsVersion: PHYSICS_VERSION,
    surfaceSignature: SURFACE_SIGNATURE,
    powerMode: def.powerMode,
    assist: input.assist,
  }
  const record: RunRecord = {
    ...comparable,
    id: runId,
    carId: doc.carId,
    carName: doc.name,
    carSnapshotId: snapshotId,
    environmentVersion: def.environmentVersion,
    controls: input.controls,
    camera: input.camera,
    signature: settingsSignature(comparable),
    startedAt: input.startedAt,
    endedAt: new Date().toISOString(),
    status: outcome.status,
    endReason: outcome.endReason,
    metrics: outcome.metrics,
    eligible: outcome.eligible,
    invalidReasons: outcome.invalidReasons,
    completion: outcome.completion,
    wasBest: false,
    progress: outcome.progress,
    resets: outcome.resets,
    message: outcome.message,
    replayRef: null,
  }

  let replay = null
  try {
    replay = session.buildReplay(runId, snapshotId)
  }
  catch {
    replay = null
  }
  const saved = await repo.commitRun(record, def, outcome, replay)
  await repo.enforceReplayBudget(input.replayBudgetBytes)
  const previous = await repo.previousComparable(saved.run)
  return { run: saved.run, progress: saved.progress, previous }
}
