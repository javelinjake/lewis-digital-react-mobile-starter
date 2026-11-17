/** Challenge gates and ground markers: hoops, finish banners, painted lanes, cones and dashed arcs. */
import type { ChallengeDefinition, Gate, Marker } from '@/game/challenges/types'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { checkerTexture } from './env-textures'

const GATE_COLOURS: Record<Gate['kind'], number> = {
  checkpoint: 0x38E8FF,
  finish: 0xFFFFFF,
  entry: 0x4DFF8A,
  measure: 0xFFD21F,
  motor_cut: 0xFF7A1A,
}

interface Bucket { colour: number, geos: THREE.BufferGeometry[], emissive: number }

function strip(g: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const out = g.clone()
  out.deleteAttribute('uv')
  out.applyMatrix4(m)
  return out
}

const ROT_Y = (yaw: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)

function addGate(gate: Gate, buckets: Map<number, Bucket>, extra: THREE.Object3D): void {
  const colour = GATE_COLOURS[gate.kind]
  const bucket = buckets.get(colour) ?? { colour, geos: [], emissive: gate.kind === 'finish' ? 0 : 0.7 }
  buckets.set(colour, bucket)
  const q = ROT_Y(gate.yaw)
  const place = (local: THREE.Vector3, scale: THREE.Vector3) => new THREE.Matrix4().compose(
    new THREE.Vector3(gate.centre[0], gate.centre[1], gate.centre[2]).add(local.clone().applyQuaternion(q)),
    q,
    scale,
  )
  const post = new THREE.CylinderGeometry(0.5, 0.5, 1, 10)
  const bar = new THREE.BoxGeometry(1, 1, 1)
  const height = gate.halfHeight * 2
  const postR = gate.kind === 'finish' ? 0.045 : 0.03
  for (const side of [-1, 1])
    bucket.geos.push(strip(post, place(new THREE.Vector3(side * gate.halfWidth, 0, 0), new THREE.Vector3(postR * 2, height, postR * 2))))
  bucket.geos.push(strip(bar, place(new THREE.Vector3(0, gate.halfHeight, 0), new THREE.Vector3(gate.halfWidth * 2 + postR * 2, postR * 1.6, postR * 1.6))))
  post.dispose()
  bar.dispose()

  if (gate.kind === 'checkpoint' || gate.kind === 'entry' || gate.kind === 'measure' || gate.kind === 'motor_cut') {
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(gate.halfWidth * 2, height),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: gate.kind === 'checkpoint' ? 0.07 : 0.12, side: THREE.DoubleSide, depthWrite: false }),
    )
    curtain.position.set(gate.centre[0], gate.centre[1], gate.centre[2])
    curtain.quaternion.copy(q)
    curtain.renderOrder = 5
    extra.add(curtain)
  }
  if (gate.kind === 'finish') {
    const tex = checkerTexture()
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(gate.halfWidth * 2, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, map: tex, side: THREE.DoubleSide }),
    )
    if (tex)
      tex.repeat.set(Math.max(2, Math.round(gate.halfWidth * 4)), 1)
    banner.position.set(gate.centre[0], gate.centre[1] + gate.halfHeight - 0.17, gate.centre[2])
    banner.quaternion.copy(q)
    extra.add(banner)
  }
}

function addMarker(marker: Marker, buckets: Map<number, Bucket>, extra: THREE.Object3D): void {
  const bucketFor = (hex: string, emissive: number) => {
    const colour = new THREE.Color(hex).getHex()
    const key = colour * 10 + Math.round(emissive * 5)
    const b = buckets.get(key) ?? { colour, geos: [], emissive }
    buckets.set(key, b)
    return b
  }
  const box = new THREE.BoxGeometry(1, 1, 1)
  if (marker.kind === 'lane') {
    const { zone } = marker
    const q = ROT_Y(zone.yaw)
    const y = zone.centre[1] + 0.004
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(zone.half[0] * 2, zone.half[2] * 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(marker.colour), transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    )
    fill.rotation.x = -Math.PI / 2
    const holder = new THREE.Group()
    holder.add(fill)
    holder.position.set(zone.centre[0], y, zone.centre[2])
    holder.quaternion.copy(q)
    holder.renderOrder = 4
    extra.add(holder)
    const border = bucketFor(marker.colour, 0.35)
    const t = 0.07
    const edges: Array<[number, number, number, number]> = [
      [0, zone.half[2], zone.half[0] * 2 + t, t],
      [0, -zone.half[2], zone.half[0] * 2 + t, t],
      [zone.half[0], 0, t, zone.half[2] * 2 + t],
      [-zone.half[0], 0, t, zone.half[2] * 2 + t],
    ]
    for (const [lx, lz, sx, sz] of edges) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(zone.centre[0], y + 0.002, zone.centre[2]).add(new THREE.Vector3(lx, 0, lz).applyQuaternion(q)),
        q,
        new THREE.Vector3(sx, 0.006, sz),
      )
      border.geos.push(strip(box, m))
    }
  }
  else if (marker.kind === 'cones') {
    const cone = new THREE.ConeGeometry(0.06, 0.17, 12)
    const b = bucketFor(marker.colour, 0.15)
    const base = bucketFor('#1b1b1f', 0)
    for (const p of marker.points) {
      b.geos.push(strip(cone, new THREE.Matrix4().makeTranslation(p[0], p[1] + 0.085, p[2])))
      base.geos.push(strip(box, new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1] + 0.006, p[2]), new THREE.Quaternion(), new THREE.Vector3(0.16, 0.012, 0.16))))
    }
    cone.dispose()
  }
  else {
    const b = bucketFor(marker.colour, 0.4)
    const length = Math.abs(marker.end - marker.start) * marker.radius
    const dash = 0.36
    const gap = 0.26
    const dir = Math.sign(marker.end - marker.start) || 1
    for (let d = 0; d < length; d += dash + gap) {
      const mid = marker.start + dir * ((d + dash / 2) / marker.radius)
      const px = marker.centre[0] + Math.cos(mid) * marker.radius
      const pz = marker.centre[1] + Math.sin(mid) * marker.radius
      // Tangent heading in the XZ plane.
      const heading = Math.atan2(-Math.sin(mid) * dir, Math.cos(mid) * dir)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -heading + Math.PI / 2)
      b.geos.push(strip(box, new THREE.Matrix4().compose(new THREE.Vector3(px, marker.y + 0.004, pz), q, new THREE.Vector3(0.07, 0.006, dash))))
    }
  }
  box.dispose()
}

export interface ChallengeOverlay {
  root: THREE.Group
  dispose: () => void
}

/** Gates and markers for a challenge, merged by colour. */
export function buildChallengeOverlay(challenge: ChallengeDefinition): ChallengeOverlay {
  const root = new THREE.Group()
  root.name = `challenge-${challenge.id}`
  const buckets = new Map<number, Bucket>()
  const extras = new THREE.Group()
  for (const gate of challenge.gates) addGate(gate, buckets, extras)
  for (const marker of challenge.markers) addMarker(marker, buckets, extras)
  const owned: THREE.Material[] = []
  for (const b of buckets.values()) {
    if (b.geos.length === 0)
      continue
    const merged = mergeGeometries(b.geos)
    b.geos.forEach(g => g.dispose())
    const mat = new THREE.MeshStandardMaterial({ color: b.colour, emissive: b.colour, emissiveIntensity: b.emissive, roughness: 0.5 })
    owned.push(mat)
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = false
    root.add(mesh)
  }
  root.add(extras)
  return {
    root,
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry)
          m.geometry.dispose()
        const mat = m.material as THREE.Material | undefined
        if (mat && !Array.isArray(mat) && (mat as THREE.MeshBasicMaterial).map === null)
          mat.dispose()
      })
      owned.forEach(m => m.dispose())
      root.clear()
    },
  }
}
