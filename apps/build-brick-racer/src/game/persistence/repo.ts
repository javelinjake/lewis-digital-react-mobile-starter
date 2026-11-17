/**
 * Local persistence for cars, run snapshots, runs, replays, progress and preferences.
 *
 * - Cars use two slots (`car:{id}` and `car:{id}:prev`) with checksums, so an interrupted write falls back
 *   to the last complete car.
 * - A run and its personal-best update commit through a small journal and are idempotent per run id, so
 *   a retried save never duplicates a run and a crash recovers deterministically.
 * - A replay failure never loses the run's metrics.
 * No driving input or network is involved; everything works offline.
 */
import type { AsyncStorage } from '@ld/offline'
import type { CarDocument } from '../build/types'
import type { ChallengeDefinition } from '../challenges/types'
import type { ReplayRecord } from '../replay/types'
import type { Sealed } from './checksum'
import type { CarSnapshot, InterruptedAttempt, PlayerPreferences, ProgressRecord, RunRecord, SaveOutcome } from './types'
import { seal, unseal } from './checksum'
import { migrateCar } from './migrations'
import { applyRun, emptyProgress } from './progress'
import { DEFAULT_PREFERENCES, PREFERENCES_SCHEMA_VERSION } from './types'

/** Minimal string store (Capacitor Preferences or localStorage) for small preference values. */
export interface StringStore {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
}

export interface CarSummary {
  id: string
  name: string
  updatedAt: string
  partCount: number
  starterId: string | null
}

export interface LoadedCar {
  doc: CarDocument
  /** The newest slot was damaged and the previous complete save was used. */
  recovered: boolean
  migrated: boolean
}

const KEYS = {
  car: (id: string) => `car:${id}`,
  carPrev: (id: string) => `car:${id}:prev`,
  backup: (id: string, v: number) => `backup:car:${id}:v${v}`,
  thumb: (id: string) => `thumb:${id}`,
  snapshot: (id: string) => `snapshot:${id}`,
  run: (id: string) => `run:${id}`,
  replay: (runId: string) => `replay:${runId}`,
  progress: (sig: string) => `progress:${sig}`,
  journal: (runId: string) => `journal:${runId}`,
  attempt: 'attempt:active',
  prefs: 'prefs',
} as const

function classify(error: unknown): NonNullable<SaveOutcome['error']> {
  const name = (error as { name?: string } | null)?.name ?? ''
  const message = String((error as { message?: string } | null)?.message ?? '')
  return /quota|full|space/i.test(`${name} ${message}`) ? 'storage_full' : 'storage_error'
}

export class GameRepo {
  constructor(
    private readonly db: AsyncStorage,
    private readonly kv: StringStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  // ---- Cars ---------------------------------------------------------------------------------------

  async saveCar(doc: CarDocument): Promise<SaveOutcome> {
    try {
      const current = await this.db.get<Sealed<CarDocument>>(KEYS.car(doc.carId))
      // Keep the last complete version until the new write has succeeded.
      if (current && unseal(current))
        await this.db.set(KEYS.carPrev(doc.carId), current)
      await this.db.set(KEYS.car(doc.carId), seal(doc, this.now()))
      return { ok: true }
    }
    catch (error) {
      return { ok: false, error: classify(error) }
    }
  }

  async loadCar(id: string): Promise<LoadedCar | null> {
    const candidates: Array<{ raw: unknown, recovered: boolean }> = []
    const main = await this.db.get<Sealed<CarDocument>>(KEYS.car(id))
    const mainDoc = main ? unseal(main) : null
    if (mainDoc)
      candidates.push({ raw: mainDoc, recovered: false })
    const prev = await this.db.get<Sealed<CarDocument>>(KEYS.carPrev(id))
    const prevDoc = prev ? unseal(prev) : null
    if (prevDoc)
      candidates.push({ raw: prevDoc, recovered: Boolean(main) })

    for (const c of candidates) {
      const result = migrateCar(c.raw)
      if (!result.ok)
        continue
      if (result.migrated) {
        // Keep an untouched backup of the original until the migrated car is written.
        await this.db.set(KEYS.backup(id, result.from), c.raw)
        const saved = await this.saveCar(result.doc)
        if (saved.ok)
          await this.db.remove(KEYS.backup(id, result.from))
      }
      return { doc: result.doc, recovered: c.recovered, migrated: result.migrated }
    }
    return null
  }

  async listCars(): Promise<CarSummary[]> {
    const keys = (await this.db.keys()).filter(k => k.startsWith('car:') && !k.endsWith(':prev'))
    const out: CarSummary[] = []
    for (const key of keys) {
      const loaded = await this.loadCar(key.slice(4))
      if (loaded) {
        out.push({
          id: loaded.doc.carId,
          name: loaded.doc.name,
          updatedAt: loaded.doc.updatedAt,
          partCount: loaded.doc.instances.length,
          starterId: loaded.doc.starterId,
        })
      }
    }
    return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }

  /** Delete the car. Snapshots referenced by saved runs are kept so history and replays still work. */
  async deleteCar(id: string): Promise<void> {
    await this.db.remove(KEYS.car(id))
    await this.db.remove(KEYS.carPrev(id))
    await this.db.remove(KEYS.thumb(id))
  }

  async saveThumbnail(carId: string, dataUrl: string): Promise<void> {
    try {
      await this.db.set(KEYS.thumb(carId), dataUrl)
    }
    catch {
      // A missing thumbnail falls back to a generated one.
    }
  }

  getThumbnail(carId: string): Promise<string | undefined> {
    return this.db.get<string>(KEYS.thumb(carId))
  }

  // ---- Snapshots, runs, progress, replays ------------------------------------------------------------

  /** Immutable per-revision snapshot. Saving the same revision twice keeps one record. */
  async saveSnapshot(doc: CarDocument): Promise<string> {
    const id = `${doc.carId}-${doc.revisionId}`
    const existing = await this.db.get<Sealed<CarSnapshot>>(KEYS.snapshot(id))
    if (existing && unseal(existing))
      return id
    const snapshot: CarSnapshot = { id, carId: doc.carId, revisionId: doc.revisionId, createdAt: this.now(), doc: structuredClone(doc) }
    await this.db.set(KEYS.snapshot(id), seal(snapshot, this.now()))
    return id
  }

  async getSnapshot(id: string): Promise<CarSnapshot | null> {
    const sealed = await this.db.get<Sealed<CarSnapshot>>(KEYS.snapshot(id))
    return sealed ? unseal(sealed) : null
  }

  getRun(id: string): Promise<RunRecord | undefined> {
    return this.db.get<RunRecord>(KEYS.run(id))
  }

  async listRuns(filter?: (run: RunRecord) => boolean): Promise<RunRecord[]> {
    const keys = (await this.db.keys()).filter(k => k.startsWith('run:'))
    const runs: RunRecord[] = []
    for (const key of keys) {
      const run = await this.db.get<RunRecord>(key)
      if (run && (!filter || filter(run)))
        runs.push(run)
    }
    return runs.sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
  }

  /** Most recent earlier finished run with identical comparable settings. */
  async previousComparable(run: RunRecord): Promise<RunRecord | null> {
    const runs = await this.listRuns(r => r.signature === run.signature && r.id !== run.id && r.status === 'finished' && r.endedAt <= run.endedAt)
    return runs[0] ?? null
  }

  getProgress(signature: string): Promise<ProgressRecord | undefined> {
    return this.db.get<ProgressRecord>(KEYS.progress(signature))
  }

  async listProgress(): Promise<ProgressRecord[]> {
    const keys = (await this.db.keys()).filter(k => k.startsWith('progress:'))
    const out: ProgressRecord[] = []
    for (const key of keys) {
      const p = await this.db.get<ProgressRecord>(key)
      if (p)
        out.push(p)
    }
    return out
  }

  /**
   * Persist a run and its progress update together. Idempotent for a run id: a retry returns the saved
   * record. A replay that fails to save leaves the run and its metrics intact with no replay reference.
   */
  async commitRun(
    run: RunRecord,
    def: ChallengeDefinition,
    outcome: Parameters<typeof applyRun>[1]['outcome'],
    replay: ReplayRecord | null,
  ): Promise<{ run: RunRecord, progress: ProgressRecord, replaySaved: boolean }> {
    const existing = await this.getRun(run.id)
    const journal = await this.db.get<unknown>(KEYS.journal(run.id))
    if (existing && !journal) {
      const progress = (await this.getProgress(existing.signature)) ?? emptyProgress(existing.signature, existing.challengeId)
      return { run: existing, progress, replaySaved: existing.replayRef !== null }
    }

    const prev = (await this.getProgress(run.signature)) ?? emptyProgress(run.signature, run.challengeId)
    const applied = applyRun(prev, { id: run.id, outcome }, def)
    const finalRun: RunRecord = { ...run, wasBest: applied.wasBest, replayRef: replay ? KEYS.replay(run.id) : null }

    await this.db.set(KEYS.journal(run.id), { run: finalRun, progress: applied.progress })
    await this.db.set(KEYS.run(run.id), finalRun)
    await this.db.set(KEYS.progress(run.signature), applied.progress)

    let replaySaved = false
    if (replay) {
      try {
        await this.db.set(KEYS.replay(run.id), replay)
        replaySaved = true
      }
      catch {
        await this.db.set(KEYS.run(run.id), { ...finalRun, replayRef: null })
        finalRun.replayRef = null
      }
    }
    await this.db.remove(KEYS.journal(run.id))
    return { run: finalRun, progress: applied.progress, replaySaved }
  }

  /** Finish any commit that was interrupted. Safe to call on every launch. */
  async recoverJournal(): Promise<number> {
    const keys = (await this.db.keys()).filter(k => k.startsWith('journal:'))
    let recovered = 0
    for (const key of keys) {
      const entry = await this.db.get<{ run: RunRecord, progress: ProgressRecord }>(key)
      if (entry) {
        await this.db.set(KEYS.run(entry.run.id), entry.run)
        await this.db.set(KEYS.progress(entry.run.signature), entry.progress)
        recovered += 1
      }
      await this.db.remove(key)
    }
    return recovered
  }

  getReplay(runId: string): Promise<ReplayRecord | undefined> {
    return this.db.get<ReplayRecord>(KEYS.replay(runId))
  }

  /**
   * Keep replay storage within a budget. Replays for each signature's personal best and latest attempt
   * are pinned and evicted last; the oldest unpinned replay data goes first. Runs and cars stay saved.
   */
  async enforceReplayBudget(budgetBytes: number): Promise<string[]> {
    const progress = await this.listProgress()
    const pinned = new Set(progress.flatMap(p => [p.bestRunId, p.lastAttemptId]).filter((x): x is string => Boolean(x)))
    const keys = (await this.db.keys()).filter(k => k.startsWith('replay:'))
    const items: Array<{ runId: string, size: number, createdAt: string, pinned: boolean }> = []
    for (const key of keys) {
      const r = await this.db.get<ReplayRecord>(key)
      if (r)
        items.push({ runId: r.runId, size: r.sizeBytes, createdAt: r.createdAt, pinned: pinned.has(r.runId) || r.pinned })
    }
    let total = items.reduce((a, b) => a + b.size, 0)
    const evicted: string[] = []
    const order = [...items].sort((a, b) => Number(a.pinned) - Number(b.pinned) || (a.createdAt < b.createdAt ? -1 : 1))
    for (const item of order) {
      if (total <= budgetBytes)
        break
      await this.db.remove(KEYS.replay(item.runId))
      const run = await this.getRun(item.runId)
      if (run)
        await this.db.set(KEYS.run(run.id), { ...run, replayRef: null })
      total -= item.size
      evicted.push(item.runId)
    }
    return evicted
  }

  // ---- Preferences and attempts ---------------------------------------------------------------------

  async loadPrefs(): Promise<PlayerPreferences> {
    try {
      const text = await this.kv.get(KEYS.prefs)
      if (!text)
        return { ...DEFAULT_PREFERENCES }
      const raw = JSON.parse(text) as Partial<PlayerPreferences>
      return {
        ...DEFAULT_PREFERENCES,
        ...raw,
        controls: { ...DEFAULT_PREFERENCES.controls, ...raw.controls },
        audio: { ...DEFAULT_PREFERENCES.audio, ...raw.audio },
        tutorial: { ...DEFAULT_PREFERENCES.tutorial, ...raw.tutorial },
        schemaVersion: PREFERENCES_SCHEMA_VERSION,
      }
    }
    catch {
      return { ...DEFAULT_PREFERENCES }
    }
  }

  async savePrefs(prefs: PlayerPreferences): Promise<void> {
    try {
      await this.kv.set(KEYS.prefs, JSON.stringify(prefs))
    }
    catch {
      // Preferences are a convenience; play continues with the in-memory values.
    }
  }

  async beginAttempt(info: Omit<InterruptedAttempt, 'startedAt'>): Promise<void> {
    try {
      await this.db.set(KEYS.attempt, { ...info, startedAt: this.now() })
    }
    catch {
      // Not recording the attempt only loses the interrupted-run notice.
    }
  }

  async endAttempt(): Promise<void> {
    await this.db.remove(KEYS.attempt)
  }

  /** An attempt that was running when the app was killed. It never becomes a completed record. */
  async takeInterrupted(): Promise<InterruptedAttempt | null> {
    const info = await this.db.get<InterruptedAttempt>(KEYS.attempt)
    if (!info)
      return null
    await this.db.remove(KEYS.attempt)
    return info
  }
}
