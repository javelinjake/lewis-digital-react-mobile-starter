import type { CarDocument, PartInstance } from '@/game/build/types'
import * as THREE from 'three'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyDoc, sequentialContext } from '@/game/build/doc'
import { catalog } from '@/game/catalog/catalog'
import { buildStarter } from '@/game/catalog/starters'
import { UNITS } from '@/game/units'
import { compileVehicle } from '@/game/vehicle/compile'
import {
  buildBuilderModel,
  buildDrivingCarModel,
  createFloorMat,
  createGhost,
  createMirrorPlane,
  createSceneKit,
  createSnapMarkers,
  fallbackThumbnail,
  renderCarThumbnail,
  WebGLUnavailableError,
} from '@/render'

beforeAll(() => {
  // jsdom has no canvas: textures fall back to flat colours and WebGL is unavailable.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterAll(() => vi.restoreAllMocks())

const S = UNITS.studM
const P = UNITS.plateM
const racer = () => buildStarter('racer', sequentialContext('r'))

function stressDoc(count: number): CarDocument {
  const base = createEmptyDoc(sequentialContext('s'))
  const ids = ['brick_2x4', 'plate_2x6', 'brick_1x2', 'slope_long', 'plate_4x6', 'brick_2x2', 'beam_1x8', 'curve_short', 'wedge_left', 'plate_2x2']
  const instances: PartInstance[] = Array.from({ length: count }, (_, i) => {
    const def = catalog.get(ids[i % ids.length]!)!
    return {
      id: `i${i}`,
      defId: def.id,
      defVersion: def.version,
      pos: [(i % 20) * 9, 0, Math.floor(i / 20) * 9] as const,
      rot: (i % 4) as 0 | 1 | 2 | 3,
      colour: ['orange', 'blue', 'red', 'green', 'yellow', 'teal', 'purple', 'pink', 'white', 'grey', 'brown', 'black'][i % 12]!,
    }
  })
  return { ...base, instances, rootInstanceId: instances[0]!.id }
}

describe('builder model', () => {
  it('merges a starter into a handful of meshes and materials', () => {
    for (const id of ['racer', 'buggy'] as const) {
      const doc = buildStarter(id, sequentialContext(id))
      const model = buildBuilderModel(doc, catalog)
      expect(model.stats.meshes).toBeLessThanOrEqual(12)
      expect(model.stats.materials).toBeLessThanOrEqual(12)
      expect(model.stats.triangles).toBeGreaterThan(2000)
      expect(model.stats.triangles).toBeLessThan(15000)
      expect(model.bounds.size).toBe(doc.instances.length)
      model.dispose()
    }
  })

  it('skips studs hidden by connected parts', () => {
    const doc = racer()
    const connected = buildBuilderModel(doc, catalog)
    const unconnected = buildBuilderModel({ ...doc, connections: [] }, catalog)
    expect(connected.stats.triangles).toBeLessThan(unconnected.stats.triangles)
    connected.dispose()
    unconnected.dispose()
  })

  it('picks the nearest instance along a ray and nothing when it misses', () => {
    const doc = racer()
    const model = buildBuilderModel(doc, catalog)
    const spoiler = doc.instances.find(i => i.defId === 'spoiler')!
    const box = model.bounds.get(spoiler.id)!
    const cx = (box.min[0] + box.max[0]) / 2
    const cz = (box.min[2] + box.max[2]) / 2
    const down = new THREE.Ray(new THREE.Vector3(cx, 2, cz), new THREE.Vector3(0, -1, 0))
    expect(model.pick(down)).toBe(spoiler.id)
    const miss = new THREE.Ray(new THREE.Vector3(50, 2, 50), new THREE.Vector3(0, -1, 0))
    expect(model.pick(miss)).toBeNull()
    model.dispose()
  })

  it('draws a placeholder for a missing definition and never throws', () => {
    const doc = racer()
    const ghosted: CarDocument = { ...doc, instances: [...doc.instances, { id: 'gone', defId: 'removed_part', defVersion: 1, pos: [20, 0, 20], rot: 0, colour: 'red' }] }
    const model = buildBuilderModel(ghosted, catalog)
    expect(model.bounds.has('gone')).toBe(true)
    expect(model.stats.triangles).toBeGreaterThan(buildBuilderModel(doc, catalog).stats.triangles)
    model.dispose()
  })

  it('shows selection, loose and issue highlights', () => {
    const doc = racer()
    const model = buildBuilderModel(doc, catalog, { loose: new Set([doc.instances[0]!.id]) })
    const [loose, selection, issues] = model.root.children.slice(-3)
    expect([loose!.visible, selection!.visible, issues!.visible]).toEqual([false, false, false])
    model.setSelection(new Set([doc.instances[1]!.id]))
    model.setLoose(new Set([doc.instances[0]!.id]))
    model.setIssues(new Set([doc.instances[2]!.id, 'unknown-id']))
    expect([loose!.visible, selection!.visible, issues!.visible]).toEqual([true, true, true])
    model.tick(1.2)
    model.setSelection(new Set())
    expect(selection!.visible).toBe(false)
    model.dispose()
  })

  it('rebuilds a 250-part car quickly within the triangle budget', () => {
    const doc = stressDoc(250)
    const t0 = performance.now()
    const model = buildBuilderModel(doc, catalog)
    const ms = performance.now() - t0
    expect(model.bounds.size).toBe(250)
    expect(model.stats.triangles).toBeLessThan(250_000)
    expect(model.stats.meshes).toBeLessThan(30)
    expect(ms).toBeLessThan(2500)
    model.dispose()
  })

  it('matches the lattice rotation convention for part positions', () => {
    const doc = stressDoc(8)
    const model = buildBuilderModel(doc, catalog)
    for (const inst of doc.instances) {
      const placedBox = model.bounds.get(inst.id)!
      expect(placedBox.min[0]).toBeCloseTo(inst.pos[0] * S, 9)
      expect(placedBox.min[1]).toBeCloseTo(inst.pos[1] * P, 9)
    }
    model.dispose()
  })
})

describe('driving model', () => {
  const setup = () => {
    const doc = racer()
    const compiled = compileVehicle(doc, catalog)
    if (!compiled.ok)
      throw new Error('compile')
    return { doc, spec: compiled.spec, model: buildDrivingCarModel(doc, compiled.spec, catalog) }
  }

  it('creates one node per wheel in spec order, placed in the body frame', () => {
    const { spec, model } = setup()
    expect(model.wheelNodes).toHaveLength(spec.wheels.length)
    spec.wheels.forEach((w, i) => {
      expect(model.wheelNodes[i]!.position.x).toBeCloseTo(w.pos[0], 9)
      expect(model.wheelNodes[i]!.position.y).toBeCloseTo(w.pos[1], 9)
      expect(model.wheelNodes[i]!.position.z).toBeCloseTo(w.pos[2], 9)
    })
    model.dispose()
  })

  it('faces every hub cap away from the car on both sides', () => {
    const { spec, model } = setup()
    model.root.updateMatrixWorld(true)
    spec.wheels.forEach((w, i) => {
      const orient = model.wheelNodes[i]!.children[0]!.children[0]!
      const wheelWidth = w.width
      // The hub cap sits toward the outer face, +X of the wheel-centred geometry.
      const cap = orient.localToWorld(new THREE.Vector3(wheelWidth * 0.45, 0, 0))
      const centre = orient.localToWorld(new THREE.Vector3(0, 0, 0))
      expect(Math.abs(cap.x)).toBeGreaterThan(Math.abs(centre.x))
      expect(Math.sign(cap.x - centre.x)).toBe(Math.sign(w.pos[0]))
    })
    model.dispose()
  })

  it('applies steer, spin and suspension offset', () => {
    const { spec, model } = setup()
    const steeringIndex = spec.wheels.findIndex(w => w.steering)
    model.update(spec.wheels.map((_, i) => ({ steer: i === steeringIndex ? 0.3 : 0, spin: Math.PI / 2, offset: 0.01 })))
    const node = model.wheelNodes[steeringIndex]!
    expect(node.rotation.y).toBeCloseTo(-0.3, 9)
    expect(node.position.y).toBeCloseTo(spec.wheels[steeringIndex]!.pos[1] + 0.01, 9)
    const spin = node.children[0]!
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(spin.quaternion)
    expect(axis.x).toBeCloseTo(1, 6)
    expect(spin.quaternion.w).toBeCloseTo(Math.cos(Math.PI / 4), 6)
    model.setBrakeLights(true)
    model.dispose()
  })
})

describe('editor helpers', () => {
  it('builds ghosts for valid and invalid placements', () => {
    const def = catalog.get('brick_2x2')!
    const g = createGhost(def, [1, 2, 3], 1, 'valid')
    const meshes = g.children.filter(c => (c as THREE.Mesh).isMesh)
    expect(meshes.length).toBeGreaterThan(0)
    expect(g.userData.state).toBe('valid')
    expect(createGhost(def, [0, 0, 0], 0, 'invalid').userData.state).toBe('invalid')
  })

  it('places the mirror plane at the doubled X coordinate', () => {
    const plane = createMirrorPlane(6, { min: [0, 0, 0], max: [0.3, 0.2, 0.7] })
    const box = new THREE.Box3().setFromObject(plane)
    expect(box.min.x).toBeCloseTo(3 * S, 6)
    expect(box.max.x).toBeCloseTo(3 * S, 6)
  })

  it('draws one ring per anchor', () => {
    const markers = createSnapMarkers()
    markers.set([[1, 3, 1], [2, 3, 1], [0, 2, 1]], 1, ['stud', 'stud', 'axle'])
    const mesh = markers.root.children[0] as THREE.InstancedMesh
    expect(mesh.count).toBe(3)
    markers.set([], undefined)
    expect(mesh.count).toBe(0)
    markers.tick(0.4)
    markers.dispose()
  })

  it('creates a floor mat with its top at y = 0', () => {
    const mat = createFloorMat(1, 2)
    const box = new THREE.Box3().setFromObject(mat)
    expect(box.max.y).toBeCloseTo(0, 6)
    expect(box.max.z - box.min.z).toBeCloseTo(2, 6)
  })
})

describe('scene kit and thumbnails', () => {
  it('throws WebGLUnavailableError without WebGL', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => createSceneKit(document.createElement('canvas'))).toThrow(WebGLUnavailableError)
  })

  it('resolves a thumbnail to null when rendering is impossible and offers a safe fallback', async () => {
    expect(await renderCarThumbnail(racer(), catalog)).toBeNull()
    const url = fallbackThumbnail('<script>x</script>')
    expect(url.startsWith('data:image/svg+xml')).toBe(true)
    expect(decodeURIComponent(url)).not.toContain('<script>')
  })
})
