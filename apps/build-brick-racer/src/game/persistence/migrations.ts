/**
 * Explicit save migrations. A car record from an older schema is migrated step by step; an untouched
 * backup of the original stays until the migrated car has been written successfully.
 */
import type { CarDocument, PartInstance } from '../build/types'
import { CAR_SCHEMA_VERSION } from '../build/types'
import { normRot } from '../lattice'

type Raw = Record<string, unknown>

/** Version 0 was the pre-release format: flat `parts` with x/y/z fields and a `facing` axis. */
function v0ToV1(raw: Raw): Raw {
  const parts = Array.isArray(raw.parts) ? raw.parts as Raw[] : []
  const instances: PartInstance[] = parts.map((p, i) => ({
    id: String(p.id ?? `m${i}`),
    defId: String(p.def ?? p.defId ?? ''),
    defVersion: Number(p.version ?? 1),
    pos: [Number(p.x ?? 0), Number(p.y ?? 0), Number(p.z ?? 0)],
    rot: normRot(Number(p.rot ?? 0)),
    colour: String(p.color ?? p.colour ?? 'orange'),
  }))
  const { parts: _parts, facing, id, ...rest } = raw
  void _parts
  const now = new Date().toISOString()
  return {
    ...rest,
    schemaVersion: 1,
    carId: String(raw.carId ?? id ?? ''),
    revisionId: String(raw.revisionId ?? `mig-${id ?? 'car'}`),
    parentRevisionId: null,
    name: String(raw.name ?? 'My car'),
    createdAt: String(raw.createdAt ?? now),
    updatedAt: String(raw.updatedAt ?? now),
    starterId: (raw.starterId as string | null | undefined) ?? null,
    forward: facing === 'x+' || facing === 'x-' || facing === 'z-' ? facing : 'z+',
    rootInstanceId: instances[0]?.id ?? null,
    instances,
    connections: [],
    wheelGroups: [],
    ui: { category: 'bricks', mirrorPlane2: null, camera: null },
    thumbnailRef: null,
  }
}

const STEPS: Record<number, (raw: Raw) => Raw> = {
  0: v0ToV1,
}

export type MigrationResult
  = | { ok: true, doc: CarDocument, migrated: boolean, from: number }
    | { ok: false, reason: 'future_version' | 'invalid' }

export function migrateCar(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== 'object')
    return { ok: false, reason: 'invalid' }
  let cur = raw as Raw
  const from = Number(cur.schemaVersion ?? 0)
  if (!Number.isFinite(from))
    return { ok: false, reason: 'invalid' }
  if (from > CAR_SCHEMA_VERSION)
    return { ok: false, reason: 'future_version' }
  for (let v = from; v < CAR_SCHEMA_VERSION; v++) {
    const step = STEPS[v]
    if (!step)
      return { ok: false, reason: 'invalid' }
    cur = step(cur)
  }
  if (typeof cur.carId !== 'string' || !Array.isArray(cur.instances))
    return { ok: false, reason: 'invalid' }
  return { ok: true, doc: cur as unknown as CarDocument, migrated: from < CAR_SCHEMA_VERSION, from }
}
