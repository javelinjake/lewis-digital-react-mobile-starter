import type { Bounds } from '@/features/builder/logic/orbit'
import type { CarDocument } from '@/game/build/types'
import type { BuilderModel } from '@/render'
import * as THREE from 'three'
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

/**
 * A screen point (CSS pixels inside the canvas) where tapping would pick `id`, or null when it is fully
 * hidden. Samples the part's box centre, face centres and inset corners. Used by the dev test probe.
 */
export function findPickablePoint(model: BuilderModel | null, camera: THREE.PerspectiveCamera, width: number, height: number, id: string): { x: number, y: number } | null {
  const b = model?.bounds.get(id)
  if (!model || !b)
    return null
  const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
  const e = [(b.max[0] - b.min[0]) / 2, (b.max[1] - b.min[1]) / 2, (b.max[2] - b.min[2]) / 2]
  const samples: Array<[number, number, number]> = [[c[0]!, c[1]!, c[2]!]]
  for (const axis of [0, 1, 2]) {
    for (const sign of [-1, 1]) {
      const p: [number, number, number] = [c[0]!, c[1]!, c[2]!]
      p[axis] += sign * e[axis]! * 0.9
      samples.push(p)
    }
  }
  const ray = new THREE.Raycaster()
  camera.updateMatrixWorld()
  for (const s of samples) {
    const v = new THREE.Vector3(...s).project(camera)
    const x = (v.x * 0.5 + 0.5) * width
    const y = (-v.y * 0.5 + 0.5) * height
    ray.setFromCamera(new THREE.Vector2(v.x, v.y), camera)
    if (v.z < 1 && x >= 0 && y >= 0 && x <= width && y <= height && model.pick(ray.ray) === id)
      return { x, y }
  }
  return null
}
