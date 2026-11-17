import type { StringStore } from '@/game/persistence/repo'
import type { RunRecord } from '@/game/persistence/types'
import { createMemoryStorage } from '@ld/offline'
import { describe, expect, it } from 'vitest'
import { getChallenge } from '@/game/challenges'
import { settingsSignature } from '@/game/comparison'
import { GameRepo } from '@/game/persistence/repo'
import { PHYSICS_VERSION, SURFACE_SIGNATURE } from '@/game/vehicle/physics-config'

const kv = (): StringStore => { const m = new Map<string, string>(); return { get: async k => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) } }
let n = 0
function rec(over: Partial<RunRecord>): RunRecord {
  const base = { challengeId: 'kitchen_coast' as const, challengeVersion: 1, physicsVersion: PHYSICS_VERSION, surfaceSignature: SURFACE_SIGNATURE, powerMode: 'motor' as const, assist: 'light' as const }
  n++
  return { ...base, id: `r${n}`, carId: 'c', carName: 'c', carSnapshotId: 's', environmentVersion: 1, controls: { leftHanded: false, scale: 1 }, camera: 'chase', signature: settingsSignature(base), startedAt: '2026', endedAt: `2026-01-01T00:00:0${n}.000Z`, status: 'finished', endReason: 'finished', metrics: { exitSpeed: 2 }, eligible: true, invalidReasons: [], completion: 'finished', wasBest: false, progress: 1, resets: 0, message: null, replayRef: null, ...over }
}
const outcome = (r: RunRecord) => ({ status: r.status, eligible: r.eligible, completion: r.completion, metrics: r.metrics, progress: r.progress })

describe('previousComparable', () => {
  it('skips earlier runs that were flagged not comparable (braked / out-of-range entry / reset)', async () => {
    const repo = new GameRepo(createMemoryStorage(), kv())
    const def = getChallenge('kitchen_coast')!
    const a = rec({ metrics: { exitSpeed: 2 } })
    const b = rec({ metrics: { exitSpeed: 3.9 }, eligible: false, invalidReasons: ['Braked during the test'] })
    const c = rec({ metrics: { exitSpeed: 2.2 } })
    for (const r of [a, b, c]) await repo.commitRun(r, def, outcome(r), null)
    const prev = await repo.previousComparable(c)
    expect(prev!.id).toBe(a.id)
  })
  it('great run is not awarded to a practice (ineligible) result', async () => {
    const repo = new GameRepo(createMemoryStorage(), kv())
    const def = getChallenge('kitchen_coast')!
    const b = rec({ metrics: { exitSpeed: 3.9 }, eligible: false, invalidReasons: ['Braked during the test'], completion: 'great' })
    await repo.commitRun(b, def, outcome(b), null)
    const p = await repo.getProgress(b.signature)
    expect(p!.great).toBe(false)
  })
})
