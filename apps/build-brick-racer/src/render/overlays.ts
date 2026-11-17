import type { V3 } from './geo'
import * as THREE from 'three'
import { addPlainBox, MeshData } from './geo'

export interface Aabb {
  min: V3
  max: V3
}

export interface BoxOverlay {
  root: THREE.Group
  set: (boxes: readonly Aabb[]) => void
  /** 0..1 pulse multiplier for the face tint. */
  pulse: (k: number) => void
  dispose: () => void
}

interface OverlayStyle {
  colour: number
  faceOpacity: number
  dashed?: boolean
  inflate: number
  lineThroughGeometry: boolean
  renderOrder: number
}

const EDGE_PAIRS: Array<[number, number]> = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]]

function corners(b: Aabb, inflate: number): V3[] {
  const out: V3[] = []
  for (let i = 0; i < 8; i++) {
    out.push([
      i & 1 ? b.max[0] + inflate : b.min[0] - inflate,
      i & 2 ? b.max[1] + inflate : b.min[1] - inflate,
      i & 4 ? b.max[2] + inflate : b.min[2] - inflate,
    ])
  }
  return out
}

/** Edge lines for a list of boxes. */
export function boxEdges(boxes: readonly Aabb[], inflate = 0): THREE.BufferGeometry {
  const pos: number[] = []
  for (const b of boxes) {
    const c = corners(b, inflate)
    for (const [a, d] of EDGE_PAIRS) pos.push(...c[a]!, ...c[d]!)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/** Highlight layer drawing translucent faces and edges over a set of boxes. */
export function createBoxOverlay(style: OverlayStyle): BoxOverlay {
  const root = new THREE.Group()
  root.renderOrder = style.renderOrder
  const faceMat = new THREE.MeshBasicMaterial({ color: style.colour, transparent: true, opacity: style.faceOpacity, depthWrite: false })
  const lineMat: THREE.LineBasicMaterial = style.dashed
    ? new THREE.LineDashedMaterial({ color: style.colour, dashSize: 0.014, gapSize: 0.01, depthTest: !style.lineThroughGeometry, transparent: true })
    : new THREE.LineBasicMaterial({ color: style.colour, depthTest: !style.lineThroughGeometry, transparent: true })
  const faces = new THREE.Mesh(new THREE.BufferGeometry(), faceMat)
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat)
  faces.renderOrder = style.renderOrder
  lines.renderOrder = style.renderOrder + 1
  faces.userData.sharedGeometry = false
  faces.frustumCulled = false
  lines.frustumCulled = false
  root.add(faces, lines)
  root.visible = false

  return {
    root,
    set(boxes) {
      faces.geometry.dispose()
      lines.geometry.dispose()
      root.visible = boxes.length > 0
      if (boxes.length === 0) {
        faces.geometry = new THREE.BufferGeometry()
        lines.geometry = new THREE.BufferGeometry()
        return
      }
      const md = new MeshData()
      for (const b of boxes) {
        addPlainBox(md, [b.min[0] - style.inflate, b.min[1] - style.inflate, b.min[2] - style.inflate], [b.max[0] + style.inflate, b.max[1] + style.inflate, b.max[2] + style.inflate])
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(md.positions, 3))
      g.setAttribute('normal', new THREE.Float32BufferAttribute(md.normals, 3))
      g.setIndex(md.indices)
      faces.geometry = g
      lines.geometry = boxEdges(boxes, style.inflate)
      if (style.dashed)
        lines.computeLineDistances()
    },
    pulse(k) {
      faceMat.opacity = style.faceOpacity * k
    },
    dispose() {
      faces.geometry.dispose()
      lines.geometry.dispose()
      faceMat.dispose()
      lineMat.dispose()
    },
  }
}

export const SELECTION_STYLE: OverlayStyle = { colour: 0x38E8FF, faceOpacity: 0.22, inflate: 0.0014, lineThroughGeometry: true, renderOrder: 20 }
export const LOOSE_STYLE: OverlayStyle = { colour: 0xFFB020, faceOpacity: 0.1, dashed: true, inflate: 0.0012, lineThroughGeometry: false, renderOrder: 18 }
export const ISSUE_STYLE: OverlayStyle = { colour: 0xFF4D4D, faceOpacity: 0.3, inflate: 0.0016, lineThroughGeometry: true, renderOrder: 22 }
