/**
 * Screen-space picking for snap rings. Rings are small and drawn through the car, so a finger can
 * cover several at once. These helpers pick the nearest, find rings stacked under the same spot,
 * and step through them. Pure: callers pass already-projected points.
 */
export interface ProjectedAnchor {
  /** Index into the anchor list. */
  index: number
  /** CSS pixels. */
  x: number
  y: number
  /** Distance from the camera, for depth ordering. */
  depth: number
}

/** Touch-friendly pick radius (CSS pixels). */
export const PICK_RADIUS = 28
/** Rings closer than this on screen (but at different depths) count as stacked or obscured. Neighbouring studs are not stacked. */
export const STACK_RADIUS = 5

const dist = (a: { x: number, y: number }, b: { x: number, y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** Closest ring to the point within `radius`, preferring the nearer ring to the camera on a tie. */
export function nearestAnchor(anchors: readonly ProjectedAnchor[], point: { x: number, y: number }, radius = PICK_RADIUS): ProjectedAnchor | null {
  let best: ProjectedAnchor | null = null
  let bestD = Infinity
  for (const a of anchors) {
    const d = dist(a, point)
    if (d > radius)
      continue
    if (d < bestD - 0.75 || (Math.abs(d - bestD) <= 0.75 && best && a.depth < best.depth)) {
      best = a
      bestD = d
    }
  }
  return best
}

/** All rings stacked with `centre` (including it), nearest to the camera first. */
export function stackedWith(anchors: readonly ProjectedAnchor[], centre: ProjectedAnchor, radius = STACK_RADIUS): ProjectedAnchor[] {
  return anchors
    .filter(a => a.index === centre.index || dist(a, centre) <= radius)
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
}

/** Step an index around a list of `length` items. */
export function stepCycle(length: number, current: number, direction: 1 | -1): number {
  if (length <= 0)
    return 0
  return (((current + direction) % length) + length) % length
}
