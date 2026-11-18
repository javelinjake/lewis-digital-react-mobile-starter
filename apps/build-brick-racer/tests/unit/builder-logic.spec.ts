import type { OrbitState } from '@/features/builder/logic/orbit'
import { describe, expect, it } from 'vitest'
import { CandidateEngine } from '@/features/builder/logic/candidate-engine'
import { contactPreview } from '@/features/builder/logic/contact-preview'
import { findLoosePosition } from '@/features/builder/logic/loose-position'
import { padStep } from '@/features/builder/logic/nudge'
import { cameraPosition, DIST_MAX, DIST_MIN, framePreset, lerpOrbit, orbitBy, panBy, PITCH_MAX, PITCH_MIN, zoomBy } from '@/features/builder/logic/orbit'
import { nearestAnchor, stackedWith, stepCycle } from '@/features/builder/logic/picking'
import { findPlacements } from '@/game/build/candidates'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { addParts } from '@/game/build/edit'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'

const base: OrbitState = { target: [0, 0.1, 0], yaw: 0.4, pitch: 0.5, distance: 1.2 }

describe('orbit camera maths', () => {
  it('keeps the camera the set distance from its target', () => {
    const p = cameraPosition(base)
    expect(Math.hypot(p[0], p[1] - 0.1, p[2])).toBeCloseTo(1.2, 6)
  })

  it('orbits, clamps pitch, and zooms within limits', () => {
    const swung = orbitBy(base, 100, 0)
    expect(swung.yaw).toBeLessThan(base.yaw)
    expect(orbitBy(base, 0, 10_000).pitch).toBe(PITCH_MAX)
    expect(orbitBy(base, 0, -10_000).pitch).toBe(PITCH_MIN)
    expect(zoomBy(base, 2).distance).toBeCloseTo(0.6, 6)
    expect(zoomBy(base, 1000).distance).toBe(DIST_MIN)
    expect(zoomBy(base, 0.0001).distance).toBe(DIST_MAX)
  })

  it('pans in the camera plane without changing distance or angles', () => {
    const panned = panBy(base, 60, 0, 390, 38)
    expect(panned.distance).toBe(base.distance)
    expect(panned.yaw).toBe(base.yaw)
    // Horizontal pan moves the target perpendicular to the view direction.
    const moved: [number, number, number] = [panned.target[0] - base.target[0], panned.target[1] - base.target[1], panned.target[2] - base.target[2]]
    const view: [number, number, number] = [Math.sin(base.yaw), 0, Math.cos(base.yaw)]
    expect(moved[0] * view[0] + moved[2] * view[2]).toBeCloseTo(0, 8)
    expect(Math.hypot(...moved)).toBeGreaterThan(0)
  })

  it('frames the car from standard views relative to its forward direction', () => {
    const bounds = { min: [0, -0.06, 0] as [number, number, number], max: [0.4, 0.3, 0.7] as [number, number, number] }
    const front = framePreset('front', bounds, 'z+', 38, 2)
    const fp = cameraPosition(front)
    expect(fp[2]).toBeGreaterThan(front.target[2])
    expect(Math.abs(fp[0] - front.target[0])).toBeLessThan(1e-6)
    const top = framePreset('top', bounds, 'z+', 38, 2)
    expect(top.pitch).toBe(PITCH_MAX)
    const back = cameraPosition(framePreset('top', bounds, 'z+', 38, 2))
    expect(back[2]).toBeLessThan(top.target[2] + 1e-3)
    const side = cameraPosition(framePreset('side', bounds, 'z+', 38, 2))
    expect(side[0]).toBeGreaterThan(front.target[0])
    // A forward of x+ rotates the front view with the car.
    const frontX = cameraPosition(framePreset('front', bounds, 'x+', 38, 2))
    expect(frontX[0]).toBeGreaterThan(front.target[0])
    expect(framePreset('threeQuarter', bounds, 'z+', 38, 2).distance).toBeGreaterThan(0.6)
  })

  it('interpolates yaw along the shortest way round', () => {
    const a: OrbitState = { ...base, yaw: 3 }
    const b: OrbitState = { ...base, yaw: -3 }
    const mid = lerpOrbit(a, b, 0.5)
    expect(Math.abs(Math.abs(mid.yaw) - Math.PI)).toBeLessThan(0.2)
  })
})

describe('screen-space picking and cycling', () => {
  const anchors = [
    { index: 0, x: 100, y: 100, depth: 5 },
    { index: 1, x: 103, y: 102, depth: 3 },
    { index: 2, x: 300, y: 100, depth: 4 },
  ]

  it('picks the nearest ring within the touch radius and nothing outside it', () => {
    expect(nearestAnchor(anchors, { x: 99, y: 99 })!.index).toBe(0)
    expect(nearestAnchor(anchors, { x: 106, y: 105 })!.index).toBe(1)
    expect(nearestAnchor(anchors, { x: 200, y: 200 })).toBeNull()
  })

  it('treats rings at equal distance as a stack and prefers the nearer to the camera', () => {
    const tied = [{ index: 0, x: 50, y: 50, depth: 9 }, { index: 1, x: 50, y: 50, depth: 2 }]
    expect(nearestAnchor(tied, { x: 52, y: 50 })!.index).toBe(1)
  })

  it('lists stacked rings nearest-first and cycles around', () => {
    const stack = stackedWith(anchors, anchors[0]!)
    expect(stack.map(a => a.index)).toEqual([1, 0])
    expect(stackedWith(anchors, anchors[2]!).map(a => a.index)).toEqual([2])
    expect(stepCycle(3, 0, 1)).toBe(1)
    expect(stepCycle(3, 2, 1)).toBe(0)
    expect(stepCycle(3, 0, -1)).toBe(2)
    expect(stepCycle(0, 0, 1)).toBe(0)
  })
})

describe('nudge pad', () => {
  it('moves one lattice step in the direction the arrow points on screen', () => {
    expect(padStep('right', 0)).toEqual([1, 0, 0])
    expect(padStep('left', 0)).toEqual([-1, 0, 0])
    expect(padStep('away', 0)).toEqual([0, 0, -1])
    expect(padStep('toward', 0)).toEqual([0, 0, 1])
    // Camera swung a quarter turn: screen-right is now -z, away is -x.
    expect(padStep('right', Math.PI / 2)).toEqual([0, 0, -1])
    expect(padStep('away', Math.PI / 2)).toEqual([-1, 0, 0])
    expect(padStep('up', 1)).toEqual([0, 1, 0])
    expect(padStep('down', 1, 3)).toEqual([0, -3, 0])
  })
})

describe('candidate engine', () => {
  const brick = catalog.get('brick_2x2')!

  it('returns the same placements as the game search and memoises per revision', async () => {
    const c = sequentialContext('e')
    const doc = buildStarter('racer', c)
    const engine = new CandidateEngine()
    const first = await engine.request(doc, brick, 0)
    expect(first.stale).toBe(false)
    expect(first.candidates.length).toBe(findPlacements(doc, brick, { rotations: [0] }, c).length)
    const second = await engine.request(doc, brick, 0)
    expect(second.candidates).toBe(first.candidates)
  })

  it('marks an older request stale when a newer one starts, so it cannot overwrite it', async () => {
    const c = sequentialContext('s')
    const doc = buildStarter('racer', c)
    const engine = new CandidateEngine()
    const older = engine.request(doc, brick, 0)
    const newer = engine.request(doc, catalog.get('plate_2x4')!, 0)
    expect((await older).stale).toBe(true)
    const latest = await newer
    expect(latest.stale).toBe(false)
    expect(latest.candidates.length).toBeGreaterThan(0)
    const cancelled = engine.request(doc, brick, 1)
    engine.cancel()
    expect((await cancelled).stale).toBe(true)
  })
})

describe('contact preview and loose placement', () => {
  it('reports four contacts, a support polygon and a centre of mass inside it for the racer', () => {
    const doc = buildStarter('racer', sequentialContext('p'))
    const p = contactPreview(doc, catalog)
    expect(p.contacts).toHaveLength(4)
    expect(p.hull).toHaveLength(4)
    expect(p.com).not.toBeNull()
    const xs = p.contacts.map(c => c.x)
    expect(p.com![0]).toBeGreaterThan(Math.min(...xs))
    expect(p.com![0]).toBeLessThan(Math.max(...xs))
    expect(p.groundY).toBeLessThan(0)
  })

  it('has no contacts for a car without wheels', () => {
    const c = sequentialContext('q')
    const doc = addParts(createEmptyDoc(c), [{ defId: 'brick_2x2', pos: [0, 0, 0], rot: 0, colour: 'red' }], c)
    if (!doc.ok)
      throw new Error('setup')
    expect(contactPreview(doc.doc, catalog).contacts).toHaveLength(0)
  })

  it('finds a free spot beside the car that commits cleanly as a loose piece', () => {
    const c = sequentialContext('l')
    const doc = buildStarter('racer', c)
    const def = catalog.get('brick_2x4')!
    const pos = findLoosePosition(doc, def, 0)
    const result = addParts(doc, [{ defId: def.id, pos, rot: 0, colour: 'red' }], c)
    expect(result.ok).toBe(true)
    expect(findLoosePosition(createEmptyDoc(c), def, 0)).toEqual([0, 0, 0])
  })
})
