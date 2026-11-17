import type { ContactPreview } from '@/features/builder/logic/contact-preview'
import type { Bounds } from '@/features/builder/logic/orbit'
/** Extra viewport overlays: wheel-group highlight, forward arrow, and the wheel contact / balance preview. */
import type { Forward } from '@/game/build/types'
import type { Aabb } from '@/render'
import * as THREE from 'three'
import { FORWARD_VECTORS } from '@/game/build/types'
import { boxEdges, disposeObject } from '@/render'

export interface Overlay {
  root: THREE.Object3D
  dispose: () => void
}

/** Bright box outlines (through the car) for the pieces an action will change. */
export function createHighlight(colour: number): Overlay & { set: (boxes: readonly Aabb[]) => void } {
  const material = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.95, depthTest: false })
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), material)
  lines.renderOrder = 24
  lines.frustumCulled = false
  const root = new THREE.Group()
  root.add(lines)
  return {
    root,
    set(boxes) {
      lines.geometry.dispose()
      lines.geometry = boxes.length > 0 ? boxEdges(boxes, 0.003) : new THREE.BufferGeometry()
    },
    dispose() {
      lines.geometry.dispose()
      material.dispose()
    },
  }
}

const ORANGE = 0xFF7A1A

/** Flat arrow on the floor in front of the car showing which way it faces. */
export function createForwardArrow(): Overlay & { set: (forward: Forward | null, bounds: Bounds, groundY: number) => void } {
  const mat = new THREE.MeshBasicMaterial({ color: ORANGE })
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.1), mat)
  shaft.position.z = -0.04
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 3), mat)
  head.rotation.x = Math.PI / 2
  head.position.z = 0.045
  head.scale.set(1, 1, 0.12)
  const arrow = new THREE.Group()
  arrow.add(shaft, head)
  const root = new THREE.Group()
  root.add(arrow)
  root.visible = false
  return {
    root,
    set(forward, bounds, groundY) {
      root.visible = forward !== null
      if (!forward)
        return
      const f = FORWARD_VECTORS[forward]
      const cx = (bounds.min[0] + bounds.max[0]) / 2
      const cz = (bounds.min[2] + bounds.max[2]) / 2
      const half = Math.abs(f[0]) > 0 ? (bounds.max[0] - bounds.min[0]) / 2 : (bounds.max[2] - bounds.min[2]) / 2
      arrow.position.set(cx + f[0] * (half + 0.14), groundY + 0.004, cz + f[2] * (half + 0.14))
      arrow.rotation.y = Math.atan2(f[0], f[2])
    },
    dispose() {
      shaft.geometry.dispose()
      head.geometry.dispose()
      mat.dispose()
    },
  }
}

/** Is the point (x, z) inside the convex hull (counter-clockwise)? */
export function pointInHull(hull: ReadonlyArray<readonly [number, number]>, x: number, z: number): boolean {
  if (hull.length < 3)
    return false
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!
    const b = hull[(i + 1) % hull.length]!
    if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0)
      return false
  }
  return true
}

/** Wheel contact points, support polygon and a centre-of-mass marker with a drop line to the floor. */
export function createContactOverlay(): Overlay & { set: (preview: ContactPreview | null) => void } {
  const root = new THREE.Group()
  root.visible = false
  const clear = () => {
    for (const child of [...root.children]) {
      disposeObject(child)
      const mesh = child as THREE.Mesh
      ;(mesh.material as THREE.Material | undefined)?.dispose?.()
      root.remove(child)
    }
  }
  return {
    root,
    set(preview) {
      clear()
      root.visible = preview !== null
      if (!preview)
        return
      const y = preview.groundY + 0.004
      const cyan = new THREE.MeshBasicMaterial({ color: 0x38E8FF, depthTest: false, transparent: true, opacity: 0.95 })
      for (const c of preview.contacts) {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.018, 20), cyan)
        disc.rotation.x = -Math.PI / 2
        disc.position.set(c.x, y, c.z)
        disc.renderOrder = 26
        root.add(disc)
      }
      if (preview.hull.length >= 2) {
        const pts = preview.hull.map(h => new THREE.Vector3(h[0], y, h[1]))
        const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x38E8FF, depthTest: false }))
        loop.renderOrder = 26
        root.add(loop)
      }
      if (preview.com) {
        const inside = pointInHull(preview.hull, preview.com[0], preview.com[2])
        const colour = inside ? 0x4DFF8A : 0xFF4D4D
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 12), new THREE.MeshBasicMaterial({ color: colour, depthTest: false }))
        ball.position.set(preview.com[0], preview.com[1], preview.com[2])
        ball.renderOrder = 28
        const drop = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(preview.com[0], preview.com[1], preview.com[2]), new THREE.Vector3(preview.com[0], y, preview.com[2])]),
          new THREE.LineBasicMaterial({ color: colour, depthTest: false }),
        )
        drop.renderOrder = 27
        const foot = new THREE.Mesh(new THREE.CircleGeometry(0.01, 14), new THREE.MeshBasicMaterial({ color: colour, depthTest: false }))
        foot.rotation.x = -Math.PI / 2
        foot.position.set(preview.com[0], y + 0.001, preview.com[2])
        foot.renderOrder = 27
        root.add(ball, drop, foot)
      }
    },
    dispose: clear,
  }
}
