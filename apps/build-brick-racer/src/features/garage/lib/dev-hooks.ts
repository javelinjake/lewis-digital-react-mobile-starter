/**
 * Development-only helpers for the screen e2e tests: seed cars and finished runs without driving.
 * Installed only when `import.meta.env.DEV` is true, so nothing ships in production builds.
 */
import type { ChallengeId } from '@/game/challenges/types'
import type { RunRecord } from '@/game/persistence/types'
import { makeId } from '@/game/build/doc'
import { getChallenge } from '@/game/challenges'
import { settingsSignature } from '@/game/comparison'
import { getRepo } from '@/lib/platform/repo'
import { PHYSICS_VERSION, SURFACE_SIGNATURE } from '@/game/vehicle/physics-config'
import { useGarageStore } from '@/stores/garage.store'

export interface SeedRunOptions {
  carId: string
  challengeId: ChallengeId
  metrics: RunRecord['metrics']
  status?: RunRecord['status']
  eligible?: boolean
  completion?: RunRecord['completion']
  wasBest?: boolean
  progress?: number
  endReason?: string | null
  withReplay?: boolean
  invalidReasons?: string[]
  assist?: 'light' | 'off'
}

declare global {
  interface Window {
    __brickScreensTest?: {
      seedCar: (kind: 'racer' | 'buggy' | 'empty') => Promise<string | null>
      seedRun: (o: SeedRunOptions) => Promise<string>
    }
  }
}

let seq = 0

export function installScreensTestHook(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined' || window.__brickScreensTest)
    return
  window.__brickScreensTest = {
    async seedCar(kind) {
      const doc = await useGarageStore.getState().create(kind)
      return doc?.carId ?? null
    },
    async seedRun(o) {
      const repo = getRepo()
      const def = getChallenge(o.challengeId)!
      const loaded = await repo.loadCar(o.carId)
      const snapshotId = await repo.saveSnapshot(loaded!.doc)
      const comparable = {
        challengeId: def.id,
        challengeVersion: def.version,
        physicsVersion: PHYSICS_VERSION,
        surfaceSignature: SURFACE_SIGNATURE,
        powerMode: def.powerMode,
        assist: o.assist ?? 'light',
      } as const
      seq += 1
      const id = `seed-${Date.now().toString(36)}-${seq}-${makeId().slice(0, 4)}`
      const finished = (o.status ?? 'finished') === 'finished'
      const record: RunRecord = {
        ...comparable,
        id,
        carId: o.carId,
        carName: loaded!.doc.name,
        carSnapshotId: snapshotId,
        environmentVersion: def.environmentVersion,
        controls: { leftHanded: false, scale: 1 },
        camera: 'chase',
        signature: settingsSignature(comparable),
        startedAt: new Date(Date.now() - 20000).toISOString(),
        endedAt: new Date(Date.now() + seq).toISOString(),
        status: o.status ?? 'finished',
        endReason: o.endReason ?? (finished ? 'finished' : 'failed'),
        metrics: o.metrics,
        eligible: o.eligible ?? finished,
        invalidReasons: o.invalidReasons ?? [],
        completion: o.completion ?? (finished ? 'finished' : null),
        wasBest: false,
        progress: o.progress ?? (finished ? 1 : 0.4),
        resets: o.metrics.resets ?? 0,
        message: null,
        replayRef: null,
      }
      const outcome = { status: record.status, eligible: record.eligible, completion: record.completion, metrics: record.metrics, progress: record.progress }
      const replay = o.withReplay
        ? {
            schemaVersion: 1,
            runId: id,
            carSnapshotId: snapshotId,
            challengeId: def.id,
            sampleHz: 15,
            wheelCount: 0,
            stride: 8,
            samples: new Float32Array(16),
            breaks: [],
            events: [],
            duration: 1,
            sizeBytes: 64,
            pinned: false,
            createdAt: new Date().toISOString(),
          }
        : null
      await repo.commitRun(record, def, outcome, replay)
      return id
    },
  }
}
