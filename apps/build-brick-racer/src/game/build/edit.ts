/**
 * Transactional edits. Every edit builds the next instance list and passes it through
 * `commit`, which re-derives connections, validates and reconciles wheel groups.
 * An invalid transaction returns issues and leaves the document untouched.
 */
import type { Rot, V3I } from '../lattice'
import type { EditContext } from './doc'
import type { BuildIssue, CarDocument, EditResult, Forward, PartInstance, WheelGroup } from './types'
import { normRot } from '../lattice'
import { computeAssemblies, looseInstanceIds } from './assemblies'
import { deriveConnections } from './connections'
import { BoxIndex, placeAll } from './geometry'
import { mountedWheelIds, overlappingParts, wheelWarnings } from './validate'
import { reconcileWheelGroups } from './wheel-groups'

export interface NewPart {
  defId: string
  pos: V3I
  rot: Rot
  colour: string
  config?: PartInstance['config']
}

interface CommitOptions {
  /** Instances that were added or changed and need full validation. */
  touched: readonly string[]
  /** Created ids for the caller (selection after paste/mirror). */
  created?: string[]
  /** Skip geometry validation (colour-only and role-only edits). */
  cosmetic?: boolean
}

function issue(code: BuildIssue['code'], message: string, instanceIds: string[], severity: BuildIssue['severity'] = 'block'): BuildIssue {
  return { code, severity, message, instanceIds }
}

export function commit(doc: CarDocument, instances: PartInstance[], ctx: EditContext, opts: CommitOptions, patch: Partial<CarDocument> = {}): EditResult {
  const touched = new Set(opts.touched)
  const ids = new Set<string>()
  for (const inst of instances) {
    if (ids.has(inst.id))
      return { ok: false, issues: [issue('duplicate_id', 'Two pieces share the same id.', [inst.id])] }
    ids.add(inst.id)
  }

  const set = placeAll(instances, ctx.catalog)
  const blocks: BuildIssue[] = []

  if (!opts.cosmetic) {
    for (const inst of instances) {
      if (!touched.has(inst.id))
        continue
      const def = ctx.catalog.get(inst.defId)
      if (!def) {
        blocks.push(issue('unknown_part', 'This piece is not in the catalogue.', [inst.id]))
        continue
      }
      if (!def.allowedRotations.includes(inst.rot))
        blocks.push(issue('rotation_not_allowed', 'This piece cannot face that way.', [inst.id]))
    }

    const index = new BoxIndex(set.placed)
    const reported = new Set<string>()
    for (const p of set.placed) {
      if (!touched.has(p.instance.id))
        continue
      for (const other of overlappingParts(p, index, new Set([p.instance.id]))) {
        const key = [p.instance.id, other.instance.id].sort().join('|')
        if (reported.has(key))
          continue
        reported.add(key)
        blocks.push(issue('overlap', 'There is no room here. Another piece is in the way.', [p.instance.id, other.instance.id]))
      }
    }
  }

  const connections = deriveConnections(set.placed)

  if (!opts.cosmetic) {
    const mounted = mountedWheelIds(set, connections)
    for (const p of set.placed) {
      if (touched.has(p.instance.id) && p.def.wheel && !mounted.has(p.instance.id))
        blocks.push(issue('wheel_unmounted', 'A wheel needs a wheel mount or axle to sit on.', [p.instance.id]))
    }
  }

  if (blocks.length > 0)
    return { ok: false, issues: blocks }

  const base = { ...doc, ...patch, instances, connections }
  const assemblies = computeAssemblies({ instances, connections, rootInstanceId: instances.some(i => i.id === doc.rootInstanceId) ? doc.rootInstanceId : null }, ctx.catalog)
  const rootInstanceId = instances.length === 0
    ? null
    : instances.some(i => i.id === doc.rootInstanceId)
      ? doc.rootInstanceId
      : (instances.find(i => assemblies.componentOf.get(i.id) === assemblies.mainIndex)?.id ?? instances[0]!.id)

  const next: CarDocument = {
    ...base,
    rootInstanceId,
    wheelGroups: opts.cosmetic && !('wheelGroups' in patch) ? doc.wheelGroups : reconcileWheelGroups({ ...base, wheelGroups: patch.wheelGroups ?? doc.wheelGroups }, set, ctx.newId),
    revisionId: ctx.newId(),
    parentRevisionId: doc.revisionId,
    updatedAt: ctx.now(),
  }

  const warnings = wheelWarnings(set)
  return { ok: true, doc: next, warnings, ...(opts.created ? { created: opts.created } : {}) }
}

export function addParts(doc: CarDocument, parts: readonly NewPart[], ctx: EditContext): EditResult {
  const created: PartInstance[] = parts.map((p) => {
    const def = ctx.catalog.get(p.defId)
    return {
      id: ctx.newId(),
      defId: p.defId,
      defVersion: def?.version ?? 0,
      pos: p.pos,
      rot: p.rot,
      colour: p.colour,
      ...(p.config ? { config: p.config } : {}),
    }
  })
  return commit(doc, [...doc.instances, ...created], ctx, { touched: created.map(c => c.id), created: created.map(c => c.id) })
}

export function movePartsBy(doc: CarDocument, ids: readonly string[], delta: V3I, ctx: EditContext): EditResult {
  const set = new Set(ids)
  const instances = doc.instances.map(i => set.has(i.id) ? { ...i, pos: [i.pos[0] + delta[0], i.pos[1] + delta[1], i.pos[2] + delta[2]] as V3I } : i)
  return commit(doc, instances, ctx, { touched: ids })
}

/** Quarter turn of the whole selection about its centre. One undo step. */
export function rotateParts(doc: CarDocument, ids: readonly string[], ctx: EditContext, turns: 1 | -1 = 1): EditResult {
  const set = new Set(ids)
  const chosen = doc.instances.filter(i => set.has(i.id))
  const placed = placeAll(chosen, ctx.catalog).placed
  if (placed.length === 0)
    return { ok: false, issues: [issue('unknown_part', 'Select a piece first.', [])] }
  const minX = Math.min(...placed.map(p => p.bounds.min[0]))
  const maxX = Math.max(...placed.map(p => p.bounds.max[0]))
  const minZ = Math.min(...placed.map(p => p.bounds.min[2]))
  const maxZ = Math.max(...placed.map(p => p.bounds.max[2]))
  const px = Math.floor((minX + maxX) / 2)
  const pz = Math.floor((minZ + maxZ) / 2)

  const instances = doc.instances.map((inst) => {
    if (!set.has(inst.id))
      return inst
    const p = placed.find(pp => pp.instance.id === inst.id)!
    const b = p.bounds
    const pos: V3I = turns === 1
      ? [px + pz - b.max[2], inst.pos[1], pz - px + b.min[0]]
      : [px - pz + b.min[2], inst.pos[1], pz + px - b.max[0]]
    return { ...inst, pos, rot: normRot(inst.rot + turns) }
  })
  return commit(doc, instances, ctx, { touched: ids })
}

export function paintParts(doc: CarDocument, ids: readonly string[], colour: string, ctx: EditContext): EditResult {
  const set = new Set(ids)
  const instances = doc.instances.map(i => set.has(i.id) ? { ...i, colour } : i)
  return commit(doc, instances, ctx, { touched: [], cosmetic: true })
}

/** Which pieces would be cut off from the main assembly by removing these. */
export function previewDelete(doc: CarDocument, ids: readonly string[], ctx: EditContext): { detached: string[], supporting: boolean } {
  const gone = new Set(ids)
  const instances = doc.instances.filter(i => !gone.has(i.id))
  const set = placeAll(instances, ctx.catalog)
  const connections = deriveConnections(set.placed)
  const before = looseInstanceIds(computeAssemblies(doc, ctx.catalog))
  const rootKept = instances.some(i => i.id === doc.rootInstanceId)
  const after = looseInstanceIds(computeAssemblies({ instances, connections, rootInstanceId: rootKept ? doc.rootInstanceId : null }, ctx.catalog))
  const detached = [...after].filter(id => !before.has(id))
  return { detached, supporting: detached.length > 0 }
}

export function deleteParts(doc: CarDocument, ids: readonly string[], ctx: EditContext): EditResult {
  const gone = new Set(ids)
  return commit(doc, doc.instances.filter(i => !gone.has(i.id)), ctx, { touched: [] })
}

function nearestFreeOffsets(width: number, depth: number, height: number): V3I[] {
  return [[width, 0, 0], [-width, 0, 0], [0, 0, depth], [0, 0, -depth], [width, 0, depth], [-width, 0, -depth], [0, height, 0], [2 * width, 0, 0], [0, 0, 2 * depth]]
}

/** Copy the selection to the nearest free space. New pieces are selected via `created`. */
export function duplicateParts(doc: CarDocument, ids: readonly string[], ctx: EditContext): EditResult {
  const set = new Set(ids)
  const chosen = doc.instances.filter(i => set.has(i.id))
  const placed = placeAll(chosen, ctx.catalog).placed
  if (placed.length === 0)
    return { ok: false, issues: [issue('unknown_part', 'Select a piece first.', [])] }
  const width = Math.max(...placed.map(p => p.bounds.max[0])) - Math.min(...placed.map(p => p.bounds.min[0]))
  const depth = Math.max(...placed.map(p => p.bounds.max[2])) - Math.min(...placed.map(p => p.bounds.min[2]))
  const height = Math.max(...placed.map(p => p.bounds.max[1])) - Math.min(...placed.map(p => p.bounds.min[1]))

  let last: EditResult | null = null
  for (const offset of nearestFreeOffsets(width, depth, height)) {
    const copies = chosen.map(i => ({ ...i, id: ctx.newId(), pos: [i.pos[0] + offset[0], i.pos[1] + offset[1], i.pos[2] + offset[2]] as V3I }))
    // A duplicated wheel keeps its mount requirement only when the mount is also duplicated.
    const result = commit(doc, [...doc.instances, ...copies], ctx, { touched: copies.map(c => c.id), created: copies.map(c => c.id) })
    if (result.ok)
      return result
    last = result
  }
  return last ?? { ok: false, issues: [issue('overlap', 'There is no room to copy this.', ids.slice())] }
}

export function setForward(doc: CarDocument, forward: Forward, ctx: EditContext): EditResult {
  return commit(doc, doc.instances, ctx, { touched: [], cosmetic: true }, { forward })
}

export type WheelRolePatch = Partial<Pick<WheelGroup, 'driven' | 'steering' | 'braking' | 'steerDirection'>>

/** Explicit role assignment per wheel group. */
export function setWheelRoles(doc: CarDocument, groupId: string, patch: WheelRolePatch, ctx: EditContext): EditResult {
  const wheelGroups = doc.wheelGroups.map(g => g.id === groupId ? { ...g, ...patch, userRoles: true } : g)
  return commit(doc, doc.instances, ctx, { touched: [], cosmetic: true }, { wheelGroups })
}

/**
 * Change every wheel in a group to another wheel definition in one transaction.
 * If any wheel cannot take the new part nothing changes.
 */
export function swapWheelGroup(doc: CarDocument, groupId: string, defId: string, ctx: EditContext): EditResult {
  const group = doc.wheelGroups.find(g => g.id === groupId)
  const next = ctx.catalog.get(defId)
  if (!group || !next?.wheel)
    return { ok: false, issues: [issue('paired_failed', 'Pick a wheel to swap to.', [])] }

  const set = placeAll(doc.instances, ctx.catalog)
  const swapped = new Map<string, PartInstance>()
  for (const id of group.instanceIds) {
    const old = set.byId.get(id)
    const hub = old?.connectors.find(c => c.type === 'hub')
    const newHubLocal = next.connectors.find(c => c.type === 'hub')
    if (!old || !hub || !newHubLocal)
      return { ok: false, issues: [issue('paired_failed', 'This wheel cannot be swapped.', [id])] }
    const inst = old.instance
    // Place the new definition so its hub lands on the same world point.
    const probe = placeAll([{ ...inst, defId, defVersion: next.version, pos: [0, 0, 0] }], ctx.catalog).placed[0]!
    const probeHub = probe.connectors.find(c => c.type === 'hub')!
    const dx = hub.pos2[0] - probeHub.pos2[0]
    const dy = hub.pos2[1] - probeHub.pos2[1]
    const dz = hub.pos2[2] - probeHub.pos2[2]
    if (dx % 2 !== 0 || dy % 2 !== 0 || dz % 2 !== 0)
      return { ok: false, issues: [issue('paired_failed', 'This wheel does not line up with that mount.', [id])] }
    swapped.set(id, { ...inst, defId, defVersion: next.version, pos: [dx / 2, dy / 2, dz / 2] })
  }

  const result = commit(doc, doc.instances.map(i => swapped.get(i.id) ?? i), ctx, { touched: [...swapped.keys()] })
  if (!result.ok) {
    const first = result.issues[0]
    return { ok: false, issues: [issue('paired_failed', first ? `Not swapped: ${first.message}` : 'Not swapped.', first?.instanceIds ?? [...swapped.keys()]), ...result.issues] }
  }
  return result
}

export function renameCar(doc: CarDocument, name: string, ctx: EditContext): CarDocument {
  return { ...doc, name: name.trim() || doc.name, updatedAt: ctx.now() }
}
