import type { PartCatalog } from '../catalog/catalog'
import type { CarDocument } from './types'
import { catalog as shippedCatalog } from '../catalog/catalog'
import { CAR_SCHEMA_VERSION } from './types'

export interface EditContext {
  catalog: PartCatalog
  newId: () => string
  now: () => string
}

let counter = 0
export function makeId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function')
    return c.randomUUID().replace(/-/g, '').slice(0, 20)
  counter += 1
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export const defaultContext: EditContext = {
  catalog: shippedCatalog,
  newId: makeId,
  now: () => new Date().toISOString(),
}

/** Deterministic context for tests and starter authoring. */
export function sequentialContext(prefix = 'p', catalog: PartCatalog = shippedCatalog): EditContext {
  let n = 0
  return {
    catalog,
    newId: () => `${prefix}${++n}`,
    now: () => '2026-01-01T00:00:00.000Z',
  }
}

export function createEmptyDoc(ctx: EditContext = defaultContext, name = 'My car'): CarDocument {
  const now = ctx.now()
  return {
    schemaVersion: CAR_SCHEMA_VERSION,
    carId: ctx.newId(),
    revisionId: ctx.newId(),
    parentRevisionId: null,
    name,
    createdAt: now,
    updatedAt: now,
    starterId: null,
    forward: 'z+',
    rootInstanceId: null,
    instances: [],
    connections: [],
    wheelGroups: [],
    ui: { category: 'bricks', mirrorPlane2: null, camera: null },
    thumbnailRef: null,
  }
}

/** New car with the same build, fresh ids for the car and revision chain. Instance ids stay valid inside the copy. */
export function duplicateCarDoc(doc: CarDocument, ctx: EditContext = defaultContext, name?: string): CarDocument {
  const now = ctx.now()
  return {
    ...doc,
    carId: ctx.newId(),
    revisionId: ctx.newId(),
    parentRevisionId: doc.revisionId,
    name: name ?? `${doc.name} copy`,
    createdAt: now,
    updatedAt: now,
    thumbnailRef: null,
  }
}
