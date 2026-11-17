import type { V3 } from './geo'
import type { Slot } from './materials'
/**
 * Procedural shapes for every part definition, in LOCAL lattice-metre space: x in [0, W], y in [0, H],
 * z in [0, D] where W/H/D are the part size converted with UNITS. Wheels have their axle along +X with
 * the hub at x = 0 (matching the `hub` connector) and the outer face toward +X.
 */
import type { PartDefinition } from '@/game/catalog/types'
import * as THREE from 'three'
import { UNITS } from '@/game/units'
import { addBox, addCylinder, addDisc, addLathe, addPlainBox, addPrism, MeshData } from './geo'

const S = UNITS.studM
const P = UNITS.plateM
export const STUD_RADIUS = 0.3 * S
export const STUD_HEIGHT = 0.21 * S

type Slots = Map<Slot, MeshData>

function slot(slots: Slots, name: Slot): MeshData {
  let md = slots.get(name)
  if (!md) {
    md = new MeshData()
    slots.set(name, md)
  }
  return md
}

function structuralBoxes(def: PartDefinition, md: MeshData): void {
  for (const b of def.boxes)
    addBox(md, [b.min[0] * S, b.min[1] * P, b.min[2] * S], [b.max[0] * S, b.max[1] * P, b.max[2] * S])
}

/** One cylindrical stud per stud connector, individually addressable so hidden studs can be skipped. */
export function buildStudGeos(def: PartDefinition): Array<{ id: string, md: MeshData }> {
  const out: Array<{ id: string, md: MeshData }> = []
  for (const c of def.connectors) {
    if (c.type !== 'stud')
      continue
    const md = new MeshData()
    addCylinder(md, 'y', [c.pos2[0] / 2 * S, c.pos2[1] / 2 * P - 0.0006, c.pos2[2] / 2 * S], STUD_HEIGHT + 0.0006, STUD_RADIUS, STUD_RADIUS * 0.96, 10, 'end')
    out.push({ id: c.id, md })
  }
  return out
}

/** Dark pin holes along both long sides at a stud pitch. */
function pinHoles(def: PartDefinition, dark: MeshData, everyStuds: number): void {
  const [sx, sy, sz] = def.size
  const W = sx * S
  const y = (sy * P) / 2
  for (let i = 0; i < sz; i += everyStuds) {
    const z = (i + 0.5 * everyStuds) * S
    if (z > sz * S)
      break
    addDisc(dark, 'x', [-0.0004, y, z], -1, 0.011, 10)
    addDisc(dark, 'x', [W + 0.0004, y, z], 1, 0.011, 10)
  }
}

/** Short dark axle caps where a wheel can be fitted. */
function axleStubs(def: PartDefinition, dark: MeshData): void {
  for (const c of def.connectors) {
    if (c.type !== 'axle')
      continue
    const x = c.pos2[0] / 2 * S
    const out = c.dir[0]
    addCylinder(dark, 'x', [out < 0 ? x - 0.0045 : x - 0.0003, c.pos2[1] / 2 * P, c.pos2[2] / 2 * S], 0.0048, 0.012, 0.012, 14, 'end')
  }
}

function sideLabelBars(def: PartDefinition, dark: MeshData): void {
  const [sx, sy, sz] = def.size
  const W = sx * S
  const H = sy * P
  const D = sz * S
  const t = 0.0007
  addPlainBox(dark, [-t, H * 0.3, D * 0.2], [0, H * 0.7, D * 0.8])
  addPlainBox(dark, [W, H * 0.3, D * 0.2], [W + t, H * 0.7, D * 0.8])
  addPlainBox(dark, [W * 0.2, H * 0.3, -t], [W * 0.8, H * 0.7, 0])
  addPlainBox(dark, [W * 0.2, H * 0.3, D], [W * 0.8, H * 0.7, D + t])
}

function slope(def: PartDefinition, md: MeshData, curved: boolean): void {
  const [sx, sy, sz] = def.size
  const W = sx * S
  const H = sy * P
  const D = sz * S
  const front = H * 0.34
  const flat = D - S
  const loop: Array<[number, number]> = [[0, 0], [D, 0], [D, H], [flat, H]]
  if (curved) {
    const steps = 6
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * (Math.PI / 2)
      loop.push([flat - flat * Math.sin(t), front + (H - front) * Math.cos(t)])
    }
  }
  else {
    loop.push([0, front])
  }
  addPrism(md, loop, (a, b, w) => [w, b, a], 0, W)
}

function wedge(def: PartDefinition, md: MeshData, side: 'left' | 'right'): void {
  const [sx, sy, sz] = def.size
  const W = sx * S
  const H = sy * P
  const D = sz * S
  const loop: Array<[number, number]> = side === 'left'
    ? [[W, 0], [W, D], [0, D], [0, D / 2]]
    : [[0, 0], [0, D], [W, D], [W, D / 2]]
  addPrism(md, loop, (a, b, w) => [a, w, b], 0, H)
}

function cockpit(def: PartDefinition, frame: MeshData, glass: MeshData): void {
  const [sx, sy, sz] = def.size
  const W = sx * S
  const H = sy * P
  const D = sz * S
  const pillar = 0.0175
  const roofT = 0.007
  addBox(frame, [0, 0, 0], [W, P, D])
  for (const x of [0, W - pillar]) {
    for (const z of [0, D - pillar])
      addBox(frame, [x, P, z], [x + pillar, H - roofT, z + pillar], 0.002)
  }
  addBox(frame, [0.002, H - roofT, D * 0.12], [W - 0.002, H, D * 0.88], 0.003)
  const g = 0.004
  const h = H - roofT - P
  const loop: Array<[number, number]> = [
    [pillar * 0.5, P],
    [D - pillar * 0.5, P],
    [D - pillar * 0.5, P + h * 0.5],
    [D * 0.8, H - roofT],
    [D * 0.22, H - roofT],
    [pillar * 0.5, P + h * 0.35],
  ]
  addPrism(glass, loop, (a, b, w) => [w, b, a], g, W - g)
}

function wheelShape(def: PartDefinition, hub: MeshData, tyre: MeshData): void {
  const props = def.wheel!
  const R = props.radiusM
  const w = props.widthM
  const cy = (def.size[1] * P) / 2
  const cz = (def.size[2] * S) / 2
  const seg = R > 0.12 ? 28 : 22
  const c = Math.min(0.28 * w, 0.012)
  const rIn = R * 0.52
  const x0 = w * 0.04
  const x1 = w * 0.88
  const profile: Array<[number, number]> = [[rIn, x0], [R - c, x0]]
  for (let i = 1; i <= 3; i++) {
    const a = (i / 3) * (Math.PI / 2)
    profile.push([R - c + c * Math.sin(a), x0 + c - c * Math.cos(a)])
  }
  const mid = (x0 + x1) / 2
  if (props.tyre === 'road' || props.tyre === 'small' || props.tyre === 'wide')
    profile.push([R, mid - 0.003], [R - 0.0035, mid - 0.0018], [R - 0.0035, mid + 0.0018], [R, mid + 0.003])
  profile.push([R, x1 - c])
  for (let i = 1; i <= 3; i++) {
    const a = (i / 3) * (Math.PI / 2)
    profile.push([R - c + c * Math.cos(a), x1 - c + c * Math.sin(a)])
  }
  profile.push([rIn, x1])
  addLathe(tyre, cy, cz, profile, seg)

  if (props.tyre === 'offroad') {
    const lugs = 16
    for (let k = 0; k < lugs; k++) {
      const geo = new THREE.BoxGeometry((x1 - x0) * 0.82, 0.011, 0.028)
      const m = new THREE.Matrix4()
        .makeTranslation(0, cy, cz)
        .multiply(new THREE.Matrix4().makeRotationX((k / lugs) * Math.PI * 2))
        .multiply(new THREE.Matrix4().makeTranslation(mid, R - 0.0006, 0))
      tyre.addGeometry(geo, m)
      geo.dispose()
    }
  }

  // Hub: dark dish, rim lip, five spokes and a centre cap, proud of the tyre face.
  addCylinder(tyre, 'x', [w * 0.1, cy, cz], w * 0.78, R * 0.56, R * 0.56, 20, 'both')
  addLathe(hub, cy, cz, [[R * 0.5, w * 0.52], [R * 0.64, w * 0.52], [R * 0.64, w * 0.97], [R * 0.5, w * 0.97]], 24)
  for (let k = 0; k < 5; k++) {
    const len = R * 0.5
    const geo = new THREE.BoxGeometry(w * 0.2, len, R * 0.13)
    const m = new THREE.Matrix4()
      .makeTranslation(0, cy, cz)
      .multiply(new THREE.Matrix4().makeRotationX((k / 5) * Math.PI * 2))
      .multiply(new THREE.Matrix4().makeTranslation(w * 0.8, len / 2 + R * 0.06, 0))
    hub.addGeometry(geo, m)
    geo.dispose()
  }
  addCylinder(hub, 'x', [w * 0.78, cy, cz], w * 0.21, R * 0.22, R * 0.2, 16, 'end')
}

/** Build every slot of a definition in local space (studs are built separately by `buildStudGeos`). */
export function buildLocalSlots(def: PartDefinition): Map<Slot, MeshData> {
  const slots: Slots = new Map()
  const primary = slot(slots, 'primary')
  const dark = (): MeshData => slot(slots, 'tyre')

  switch (def.shape) {
    case 'box':
    case 'bumper':
      structuralBoxes(def, primary)
      break
    case 'beam':
      structuralBoxes(def, primary)
      pinHoles(def, dark(), 1)
      break
    case 'chassis':
      structuralBoxes(def, primary)
      pinHoles(def, dark(), 2)
      break
    case 'mount':
    case 'axle':
      structuralBoxes(def, primary)
      axleStubs(def, dark())
      if (def.shape === 'axle')
        pinHoles(def, dark(), 2)
      break
    case 'ballast':
      structuralBoxes(def, primary)
      sideLabelBars(def, dark())
      break
    case 'wing':
      structuralBoxes(def, primary)
      break
    case 'slope':
      slope(def, primary, false)
      break
    case 'curve':
      slope(def, primary, true)
      break
    case 'wedge_left':
      wedge(def, primary, 'left')
      break
    case 'wedge_right':
      wedge(def, primary, 'right')
      break
    case 'cockpit':
      cockpit(def, primary, slot(slots, 'glass'))
      break
    case 'wheel':
      wheelShape(def, primary, dark())
      return slots
  }

  return slots
}

/** Local-space box of a definition in metres. */
export function localSizeM(def: PartDefinition): V3 {
  return [def.size[0] * S, def.size[1] * P, def.size[2] * S]
}
