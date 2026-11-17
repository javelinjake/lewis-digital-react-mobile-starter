import * as THREE from 'three'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fakeChallenge, fakeGarden, fakeKitchen } from '@/dev/render-preview-env'
import { buildEnvironment, countTriangles } from '@/render'
import { buildChallengeOverlay } from '@/render/env-gates'

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterAll(() => vi.restoreAllMocks())

function meshes(root: THREE.Object3D) {
  const out: THREE.Mesh[] = []
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh)
      out.push(o as THREE.Mesh)
  })
  return out
}

describe('environment mesh', () => {
  it('merges boxes by material and props by colour into few meshes', () => {
    for (const env of [fakeKitchen(), fakeGarden()]) {
      const built = buildEnvironment(env)
      const count = meshes(built.root).length
      expect(count).toBeGreaterThan(2)
      expect(count).toBeLessThan(20)
      for (const m of meshes(built.root)) {
        const p = m.geometry.getAttribute('position')
        expect(p.count).toBeGreaterThan(0)
        expect(Number.isFinite(p.getX(0) + p.getY(0) + p.getZ(0))).toBe(true)
      }
      built.dispose()
    }
  })

  it('skips hidden boxes', () => {
    const env = fakeKitchen()
    const visible = countTriangles(buildEnvironment(env).root)
    const hiddenEnv = { ...env, boxes: [...env.boxes, { id: 'h', centre: [0, 5, 0] as [number, number, number], half: [1, 1, 1] as [number, number, number], surface: 'tile' as const, kind: 'wall' as const, look: { material: 'plain' as const, colour: '#fff', hidden: true } }] }
    expect(countTriangles(buildEnvironment(hiddenEnv).root)).toBe(visible)
  })

  it('maps textures in world metres', () => {
    const env = fakeKitchen()
    const floor = env.boxes.find(b => b.id === 'floor')!
    const built = buildEnvironment({ ...env, boxes: [floor], props: [] })
    const g = meshes(built.root)[0]!.geometry
    const uv = g.getAttribute('uv')
    let maxU = 0
    for (let i = 0; i < uv.count; i++) maxU = Math.max(maxU, uv.getX(i))
    // The floor's longest side is 60 m on a 1.2 m tile texture.
    expect(maxU).toBeCloseTo(60 / 1.2, 3)
  })

  it('sets and clears sky and fog on a scene', () => {
    const env = fakeGarden()
    const built = buildEnvironment(env)
    const scene = new THREE.Scene()
    built.apply(scene)
    expect(scene.background).not.toBeNull()
    expect(scene.fog).toBeInstanceOf(THREE.Fog)
    expect((scene.fog as THREE.Fog).far).toBe(env.fogFar)
    built.dispose()
    expect(scene.fog).toBeNull()
    expect(scene.background).toBeNull()
  })

  it('draws every gate kind and marker type of a challenge', () => {
    const challenge = fakeChallenge()
    const overlay = buildChallengeOverlay(challenge)
    const extras = overlay.root.children[overlay.root.children.length - 1]!
    // 4 translucent curtains (non-finish gates), 1 finish banner and 1 painted lane.
    expect(extras.children).toHaveLength(6)
    expect(overlay.root.children.length).toBeGreaterThan(3)
    const tri = countTriangles(overlay.root)
    const noMarkers = countTriangles(buildChallengeOverlay({ ...challenge, markers: [] }).root)
    expect(tri).toBeGreaterThan(noMarkers)
    const withEnv = countTriangles(buildEnvironment(fakeKitchen(), challenge).root)
    expect(withEnv).toBeGreaterThan(countTriangles(buildEnvironment(fakeKitchen()).root))
    overlay.dispose()
  })
})
