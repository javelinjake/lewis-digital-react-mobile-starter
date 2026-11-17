import type { SceneKit } from './scene-kit'
import type { CarDocument } from '@/game/build/types'
import type { PartCatalog } from '@/game/catalog/catalog'
import * as THREE from 'three'
import { FORWARD_VECTORS } from '@/game/build/types'
import { createFloorMat } from './builder-extras'
import { buildBuilderModel } from './car-model'
import { createSceneKit } from './scene-kit'

let shared: SceneKit | null = null
let sharedFailed = false

function getKit(size: number): SceneKit | null {
  if (sharedFailed || typeof document === 'undefined')
    return null
  if (!shared) {
    try {
      const canvas = document.createElement('canvas')
      shared = createSceneKit(canvas, { quality: 'high', transparent: true, shadows: false })
      shared.camera.fov = 30
    }
    catch {
      sharedFailed = true
      return null
    }
  }
  shared.renderer.setPixelRatio(1)
  shared.renderer.setSize(size, size, false)
  shared.camera.aspect = 1
  shared.camera.updateProjectionMatrix()
  return shared
}

/**
 * Render a three-quarter view of a car to a PNG data URL on one shared offscreen renderer.
 * Resolves to null on any failure so callers can use `fallbackThumbnail`.
 */
export async function renderCarThumbnail(
  doc: CarDocument,
  catalog: PartCatalog,
  opts: { size?: number, background?: 'transparent' | 'mat' } = {},
): Promise<string | null> {
  try {
    const size = opts.size ?? 256
    const kit = getKit(size)
    if (!kit || doc.instances.length === 0)
      return null
    const model = buildBuilderModel(doc, catalog)
    try {
      const box = new THREE.Box3()
      for (const b of model.bounds.values()) {
        box.expandByPoint(new THREE.Vector3(...b.min))
        box.expandByPoint(new THREE.Vector3(...b.max))
      }
      if (box.isEmpty())
        return null
      const centre = box.getCenter(new THREE.Vector3())
      const radius = box.getSize(new THREE.Vector3()).length() / 2
      kit.scene.add(model.root)
      let mat: THREE.Object3D | null = null
      if (opts.background === 'mat') {
        mat = createFloorMat(radius * 3.2, radius * 3.2)
        mat.position.set(centre.x, box.min.y - 0.001, centre.z)
        kit.scene.add(mat)
      }
      const f = new THREE.Vector3(...FORWARD_VECTORS[doc.forward])
      const left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f)
      const dir = f.multiplyScalar(0.9).add(left.multiplyScalar(0.8)).add(new THREE.Vector3(0, 0.62, 0)).normalize()
      const dist = (radius / Math.sin((kit.camera.fov * Math.PI) / 360)) * 1.04
      kit.camera.position.copy(centre).addScaledVector(dir, dist)
      kit.camera.lookAt(centre)
      kit.followSun([centre.x, centre.y, centre.z])
      kit.render()
      const url = kit.renderer.domElement.toDataURL('image/png')
      kit.scene.remove(model.root)
      if (mat) {
        kit.scene.remove(mat)
        ;(mat as THREE.Mesh).geometry?.dispose()
      }
      return url.startsWith('data:image/png') ? url : null
    }
    finally {
      model.dispose()
    }
  }
  catch {
    return null
  }
}

/** Safe inline SVG brick icon for when rendering a preview fails. */
export function fallbackThumbnail(name: string): string {
  const initial = (name.trim()[0] ?? '?').toUpperCase().replace(/[<>&"']/g, '?')
  const studs = [30, 70, 110, 150].map(x => `<rect x="${x}" y="30" width="26" height="16" rx="6" fill="#ff8f3d"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140"><rect width="200" height="140" rx="16" fill="#0f2b52"/>${studs}<rect x="22" y="42" width="156" height="58" rx="10" fill="#ff7a1a"/><text x="100" y="86" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="38" fill="#fff">${initial}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
