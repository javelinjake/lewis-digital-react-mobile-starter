import type { PlacedPart, WorldConnector } from './geometry'
import type { Connection } from './types'
import { MATING_TYPE } from '../catalog/types'

function keyOf(c: Pick<WorldConnector, 'pos2' | 'dir' | 'type'>, type = c.type, flip = false) {
  return `${c.pos2[0]},${c.pos2[1]},${c.pos2[2]}|${flip ? -c.dir[0] : c.dir[0]},${flip ? -c.dir[1] : c.dir[1]},${flip ? -c.dir[2] : c.dir[2]}|${type}`
}

export function connectionId(a: WorldConnector, b: WorldConnector): string {
  const ka = `${a.instanceId}:${a.connectorId}`
  const kb = `${b.instanceId}:${b.connectorId}`
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

export const tagsOverlap = (a: readonly string[], b: readonly string[]): boolean => a.some(t => b.includes(t))

/**
 * Connections are intent that must agree with instance transforms. This rebuilds them
 * from geometry: two connectors join when their points coincide, their directions
 * oppose, their types mate and they share a compatibility tag.
 */
export function deriveConnections(placed: readonly PlacedPart[]): Connection[] {
  const index = new Map<string, WorldConnector[]>()
  for (const p of placed) {
    for (const c of p.connectors) {
      const key = keyOf(c)
      const list = index.get(key)
      if (list)
        list.push(c)
      else
        index.set(key, [c])
    }
  }

  const seen = new Set<string>()
  const out: Connection[] = []
  for (const p of placed) {
    for (const c of p.connectors) {
      const mates = index.get(keyOf(c, MATING_TYPE[c.type], true))
      if (!mates)
        continue
      for (const m of mates) {
        if (m.instanceId === c.instanceId || !tagsOverlap(c.tags, m.tags))
          continue
        const id = connectionId(c, m)
        if (seen.has(id))
          continue
        seen.add(id)
        const [a, b] = `${c.instanceId}:${c.connectorId}` < `${m.instanceId}:${m.connectorId}` ? [c, m] : [m, c]
        out.push({
          id,
          a: { instanceId: a.instanceId, connectorId: a.connectorId },
          b: { instanceId: b.instanceId, connectorId: b.connectorId },
          type: c.type === 'stud' || c.type === 'socket' ? 'stud' : 'axle',
        })
      }
    }
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : 1))
}

/** Connector keys already used by a mate, so Easy Build only offers open anchors. */
export function occupiedConnectorKeys(connections: readonly Connection[]): Set<string> {
  const set = new Set<string>()
  for (const c of connections) {
    set.add(`${c.a.instanceId}:${c.a.connectorId}`)
    set.add(`${c.b.instanceId}:${c.b.connectorId}`)
  }
  return set
}

export { keyOf as connectorKey }
