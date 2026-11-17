import type { Aabb } from './overlays'
/** Editor helpers: placement ghost, mirror plane, snap markers and the cutting-mat floor. */
import type { PartDefinition } from '@/game/catalog/types'
import type { Rot, V3I } from '@/game/lattice'
import * as THREE from 'three'
import { placeDefinition } from '@/game/build/geometry'
import { UNITS } from '@/game/units'
import { disposeObject } from './dispose'
import { ghostMaterial } from './materials'
import { boxEdges } from './overlays'
import { buildPartGeometry } from './part-geometry'
import { canvasTexture } from './textures'

const S = UNITS.studM
const P = UNITS.plateM

/** Translucent preview of a part at its exact resulting position. Dispose with `disposeObject`. */
export function createGhost(def: PartDefinition, pos: V3I, rot: Rot, state: 'valid' | 'invalid'): THREE.Object3D {
  const group = new THREE.Group()
  group.name = `ghost-${state}`
  for (const geo of buildPartGeometry(def, { pos, rot }).bySlot.values()) {
    const mesh = new THREE.Mesh(geo, ghostMaterial(state))
    mesh.renderOrder = 30
    group.add(mesh)
  }
  const b = placeDefinition(def, pos, rot).bounds
  const edges = new THREE.LineSegments(
    boxEdges([{ min: [b.min[0] * S, b.min[1] * P, b.min[2] * S], max: [b.max[0] * S, b.max[1] * P, b.max[2] * S] }], 0.001),
    new THREE.LineBasicMaterial({ color: state === 'valid' ? 0x7DFFA6 : 0xFF8C96, transparent: true, opacity: 0.9, depthTest: false }),
  )
  edges.renderOrder = 31
  group.add(edges)
  group.userData.state = state
  return group
}

/** Vertical translucent plane showing where mirror placement reflects pieces. */
export function createMirrorPlane(planeX2: number, bounds: Aabb): THREE.Object3D {
  const x = (planeX2 / 2) * S
  const y0 = bounds.min[1] - 0.01
  const y1 = bounds.max[1] + 0.04
  const z0 = bounds.min[2] - 0.05
  const z1 = bounds.max[2] + 0.05
  const group = new THREE.Group()
  group.name = 'mirror-plane'
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(z1 - z0, y1 - y0),
    new THREE.MeshBasicMaterial({ color: 0x38E8FF, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  )
  plane.rotation.y = Math.PI / 2
  plane.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2)
  plane.renderOrder = 15
  const border = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y0, z0), new THREE.Vector3(x, y0, z1), new THREE.Vector3(x, y1, z1), new THREE.Vector3(x, y1, z0)]),
    new THREE.LineBasicMaterial({ color: 0x38E8FF, transparent: true, opacity: 0.9 }),
  )
  const centreLine = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y0, (z0 + z1) / 2), new THREE.Vector3(x, y1, (z0 + z1) / 2), new THREE.Vector3(x, (y0 + y1) / 2, z0), new THREE.Vector3(x, (y0 + y1) / 2, z1)]),
    new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: 0.02, gapSize: 0.015, transparent: true, opacity: 0.75 }),
  )
  centreLine.computeLineDistances()
  group.add(plane, border, centreLine)
  return group
}

export interface SnapMarkers {
  root: THREE.Object3D
  /** Anchors are lattice coordinates (studs, plates, studs). `kinds` picks ring orientation per anchor. */
  set: (anchors: ReadonlyArray<readonly [number, number, number]>, highlighted?: number, kinds?: ReadonlyArray<'stud' | 'socket' | 'axle'>) => void
  /** Pulse the rings; call once per frame with elapsed seconds. */
  tick: (seconds: number) => void
  dispose: () => void
}

const MAX_MARKERS = 4096

/** Pulsing green rings over open connectors, drawn through the car. */
export function createSnapMarkers(): SnapMarkers {
  const geo = new THREE.RingGeometry(0.0125, 0.0215, 28)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false, depthWrite: false })
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_MARKERS)
  mesh.count = 0
  mesh.renderOrder = 40
  mesh.frustumCulled = false
  const green = new THREE.Color(0x4DFF8A)
  const white = new THREE.Color(0xFFFFFF)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const qSide = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  const scale = new THREE.Vector3()
  const root = new THREE.Group()
  root.add(mesh)

  return {
    root,
    set(anchors, highlighted, kinds) {
      const n = Math.min(anchors.length, MAX_MARKERS)
      for (let i = 0; i < n; i++) {
        const a = anchors[i]!
        const kind = kinds?.[i] ?? 'stud'
        const s = i === highlighted ? 1.55 : 1
        scale.set(s, s, s)
        const lift = kind === 'stud' ? 0.0125 : kind === 'socket' ? -0.0012 : 0
        q.copy(kind === 'axle' ? qSide : new THREE.Quaternion())
        m.compose(new THREE.Vector3(a[0] * S, a[1] * P + lift, a[2] * S), q, scale)
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, i === highlighted ? white : green)
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor)
        mesh.instanceColor.needsUpdate = true
    },
    tick(seconds) {
      mat.opacity = 0.62 + 0.33 * Math.sin(seconds * 6)
    },
    dispose() {
      mesh.dispose()
      geo.dispose()
      mat.dispose()
    },
  }
}

/** Blue self-healing cutting mat with a stud grid, centred on the lattice origin with its top at y = 0. */
export function createFloorMat(w: number, d: number): THREE.Object3D {
  const tex = canvasTexture('floor-mat', 256, (ctx, size) => {
    ctx.fillStyle = '#1d4fa8'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 1
    const step = size / 10
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath()
      ctx.moveTo(i * step, 0)
      ctx.lineTo(i * step, size)
      ctx.moveTo(0, i * step)
      ctx.lineTo(size, i * step)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.34)'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, size - 2, size - 2)
  })
  if (tex)
    tex.repeat.set(w / 0.5, d / 0.5)
  const top = new THREE.MeshStandardMaterial({ color: tex ? 0xFFFFFF : 0x1D4FA8, map: tex, roughness: 0.55, metalness: 0 })
  const side = new THREE.MeshStandardMaterial({ color: 0x15367A, roughness: 0.7 })
  const mat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.008, d), [side, side, top, side, side, side])
  mat.position.y = -0.004
  mat.receiveShadow = true
  mat.name = 'floor-mat'
  return mat
}

export { disposeObject }
