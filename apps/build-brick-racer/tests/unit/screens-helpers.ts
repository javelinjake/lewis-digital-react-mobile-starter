import type { StringStore } from '@/game/persistence/repo'
import type { RunRecord } from '@/game/persistence/types'
import { createMemoryStorage } from '@ld/offline'
import { settingsSignature } from '@/game/comparison'
import { GameRepo } from '@/game/persistence/repo'
import { DEFAULT_PREFERENCES } from '@/game/persistence/types'
import { PHYSICS_VERSION, SURFACE_SIGNATURE } from '@/game/vehicle/physics-config'
import { setRepo } from '@/lib/platform/repo'
import { useGarageStore } from '@/stores/garage.store'
import { usePrefsStore } from '@/stores/prefs.store'
import { useSessionStore } from '@/stores/session.store'

export function memoryKv(): StringStore & { dump: () => Map<string, string> } {
  const map = new Map<string, string>()
  return { get: async k => map.get(k) ?? null, set: async (k, v) => void map.set(k, v), dump: () => map }
}

/** Fresh in-memory repository and reset stores for each test. */
export function freshRepo() {
  const kv = memoryKv()
  const repo = new GameRepo(createMemoryStorage(), kv)
  setRepo(repo)
  useGarageStore.setState({ cars: [], thumbs: {}, loaded: false, error: null, selectedId: null })
  usePrefsStore.setState({ prefs: DEFAULT_PREFERENCES, hydrated: false })
  useSessionStore.setState({ carId: null, place: 'kitchen', challengeId: null, lastChallengeByPlace: {}, interrupted: null, trying: false, lastRunId: null })
  return { repo, kv }
}

let n = 0
export function runRecord(over: Partial<RunRecord> = {}): RunRecord {
  const base = {
    challengeId: 'garden_mud' as const,
    challengeVersion: 1,
    physicsVersion: PHYSICS_VERSION,
    surfaceSignature: SURFACE_SIGNATURE,
    powerMode: 'motor' as const,
    assist: 'light' as const,
  }
  n += 1
  return {
    ...base,
    id: `run-${n}`,
    carId: 'car-1',
    carName: 'Mud Monster',
    carSnapshotId: 'snap-a',
    environmentVersion: 1,
    controls: { leftHanded: false, scale: 1 },
    camera: 'chase',
    signature: settingsSignature(base),
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: `2026-01-01T00:00:${String(n).padStart(2, '0')}.000Z`,
    status: 'finished',
    endReason: 'finished',
    metrics: { time: 21.8, peakSpeed: 2.6 },
    eligible: true,
    invalidReasons: [],
    completion: 'finished',
    wasBest: false,
    progress: 1,
    resets: 0,
    message: null,
    replayRef: null,
    ...over,
  }
}

export const outcomeOf = (r: RunRecord) => ({ status: r.status, eligible: r.eligible, completion: r.completion, metrics: r.metrics, progress: r.progress })
