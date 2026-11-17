import type { Bounds } from '@/features/builder/logic/orbit'
import type { CarDocument } from '@/game/build/types'
import type { BuilderModel } from '@/render'
import { EMPTY_BOUNDS } from '@/features/builder/logic/orbit'
import { catalog } from '@/game/catalog/catalog'

/** Run `fn` when the browser is idle (or next tick). Returns a cancel function. */
export function idle(fn: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const h = requestIdleCallback(fn, { timeout: 120 })
    return () => cancelIdleCallback(h)
  }
  const h = setTimeout(fn, 0)
  return () => clearTimeout(h)
}

/** Whole-car bounds in metres and the ground height (wheel bottoms use their true radius, not the box). */
export function measureModel(model: BuilderModel | null, doc: CarDocument): { bounds: Bounds, groundY: number } {
  if (!model || model.bounds.size === 0)
    return { bounds: EMPTY_BOUNDS, groundY: 0 }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  let ground = Infinity
  const byId = new Map(doc.instances.map(i => [i.id, i]))
  for (const [id, b] of model.bounds) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, b.min[i]!)
      max[i] = Math.max(max[i]!, b.max[i]!)
    }
    const inst = byId.get(id)
    const wheel = inst ? catalog.get(inst.defId)?.wheel : undefined
    ground = Math.min(ground, wheel ? (b.min[1] + b.max[1]) / 2 - wheel.radiusM : b.min[1])
  }
  return { bounds: { min, max }, groundY: ground }
}
