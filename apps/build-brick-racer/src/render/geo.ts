/**
 * Low-level procedural geometry. Everything accumulates into a plain `MeshData` (positions, normals,
 * indices) so parts can be merged cheaply without creating thousands of BufferGeometry objects.
 * Triangle winding is corrected against vertex normals, so shapes can never render inside-out.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type V3 = readonly [number, number, number]
export type Axis = 'x' | 'y' | 'z'

/** Immutable vertex data of a finished local-space part. */
export interface LocalGeo {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

export class MeshData {
  positions: number[] = []
  normals: number[] = []
  indices: number[] = []

  get vertexCount(): number {
    return this.positions.length / 3
  }

  get triangleCount(): number {
    return this.indices.length / 3
  }

  vertex(p: V3, n: V3): number {
    const i = this.positions.length / 3
    this.positions.push(p[0], p[1], p[2])
    this.normals.push(n[0], n[1], n[2])
    return i
  }

  /** Add a triangle, flipping it when its winding disagrees with the vertex normals. */
  tri(a: number, b: number, c: number): void {
    const p = this.positions
    const n = this.normals
    const ax = p[b * 3]! - p[a * 3]!
    const ay = p[b * 3 + 1]! - p[a * 3 + 1]!
    const az = p[b * 3 + 2]! - p[a * 3 + 2]!
    const bx = p[c * 3]! - p[a * 3]!
    const by = p[c * 3 + 1]! - p[a * 3 + 1]!
    const bz = p[c * 3 + 2]! - p[a * 3 + 2]!
    const fx = ay * bz - az * by
    const fy = az * bx - ax * bz
    const fz = ax * by - ay * bx
    if (fx * fx + fy * fy + fz * fz < 1e-18)
      return
    const sx = n[a * 3]! + n[b * 3]! + n[c * 3]!
    const sy = n[a * 3 + 1]! + n[b * 3 + 1]! + n[c * 3 + 1]!
    const sz = n[a * 3 + 2]! + n[b * 3 + 2]! + n[c * 3 + 2]!
    if (fx * sx + fy * sy + fz * sz >= 0)
      this.indices.push(a, b, c)
    else
      this.indices.push(a, c, b)
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.tri(a, b, c)
    this.tri(a, c, d)
  }

  /** Append a three.js geometry, optionally transformed. */
  addGeometry(geo: THREE.BufferGeometry, matrix?: THREE.Matrix4): void {
    const pos = geo.getAttribute('position')
    if (!geo.getAttribute('normal'))
      geo.computeVertexNormals()
    const nor = geo.getAttribute('normal')
    const index = geo.getIndex()
    const normalMatrix = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null
    const v = new THREE.Vector3()
    const base = this.vertexCount
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      if (matrix)
        v.applyMatrix4(matrix)
      this.positions.push(v.x, v.y, v.z)
      v.fromBufferAttribute(nor, i)
      if (normalMatrix)
        v.applyMatrix3(normalMatrix).normalize()
      this.normals.push(v.x, v.y, v.z)
    }
    const count = index ? index.count : pos.count
    for (let i = 0; i < count; i += 3) {
      const a = index ? index.getX(i) : i
      const b = index ? index.getX(i + 1) : i + 1
      const c = index ? index.getX(i + 2) : i + 2
      this.indices.push(base + a, base + b, base + c)
    }
  }

  isEmpty(): boolean {
    return this.indices.length === 0
  }

  toLocal(): LocalGeo {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      indices: new Uint32Array(this.indices),
    }
  }
}

export function localToGeometry(local: LocalGeo): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(local.positions.slice(), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(local.normals.slice(), 3))
  g.setIndex(new THREE.BufferAttribute(local.indices.slice(), 1))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

const roundedCache = new Map<string, THREE.BufferGeometry>()

/** Axis-aligned box from min to max with soft edges. */
export function addBox(md: MeshData, min: V3, max: V3, radius = 0.0032): void {
  const w = max[0] - min[0]
  const h = max[1] - min[1]
  const d = max[2] - min[2]
  const r = Math.min(radius, Math.min(w, h, d) * 0.34)
  if (r < 0.0004) {
    addPlainBox(md, min, max)
    return
  }
  const key = `${w.toFixed(5)}|${h.toFixed(5)}|${d.toFixed(5)}|${r.toFixed(5)}`
  let geo = roundedCache.get(key)
  if (!geo) {
    geo = new RoundedBoxGeometry(w, h, d, 1, r)
    geo.deleteAttribute('uv')
    roundedCache.set(key, geo)
  }
  md.addGeometry(geo, new THREE.Matrix4().makeTranslation((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2))
}

/** Sharp-edged box, 12 triangles. */
export function addPlainBox(md: MeshData, min: V3, max: V3): void {
  const faces: Array<{ n: V3, v: V3[] }> = [
    { n: [1, 0, 0], v: [[max[0], min[1], min[2]], [max[0], max[1], min[2]], [max[0], max[1], max[2]], [max[0], min[1], max[2]]] },
    { n: [-1, 0, 0], v: [[min[0], min[1], max[2]], [min[0], max[1], max[2]], [min[0], max[1], min[2]], [min[0], min[1], min[2]]] },
    { n: [0, 1, 0], v: [[min[0], max[1], min[2]], [min[0], max[1], max[2]], [max[0], max[1], max[2]], [max[0], max[1], min[2]]] },
    { n: [0, -1, 0], v: [[min[0], min[1], max[2]], [min[0], min[1], min[2]], [max[0], min[1], min[2]], [max[0], min[1], max[2]]] },
    { n: [0, 0, 1], v: [[max[0], min[1], max[2]], [max[0], max[1], max[2]], [min[0], max[1], max[2]], [min[0], min[1], max[2]]] },
    { n: [0, 0, -1], v: [[min[0], min[1], min[2]], [min[0], max[1], min[2]], [max[0], max[1], min[2]], [max[0], min[1], min[2]]] },
  ]
  for (const f of faces) {
    const i = f.v.map(p => md.vertex(p, f.n))
    md.quad(i[0]!, i[1]!, i[2]!, i[3]!)
  }
}

function basis(axis: Axis): { a: V3, u: V3, v: V3 } {
  if (axis === 'x')
    return { a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] }
  if (axis === 'y')
    return { a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] }
  return { a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }
}

function at(c: V3, a: V3, t: number, u: V3, x: number, v: V3, y: number): V3 {
  return [c[0] + a[0] * t + u[0] * x + v[0] * y, c[1] + a[1] * t + u[1] * x + v[1] * y, c[2] + a[2] * t + u[2] * x + v[2] * y]
}

/**
 * Cylinder or cone running from `base` along +axis for `len`.
 * `caps`: 'both', 'end' (far end only), or 'none'.
 */
export function addCylinder(md: MeshData, axis: Axis, base: V3, len: number, rBase: number, rEnd: number, seg: number, caps: 'both' | 'end' | 'none' = 'both'): void {
  const { a, u, v } = basis(axis)
  const slope = (rBase - rEnd) / Math.max(len, 1e-9)
  const ringB: number[] = []
  const ringE: number[] = []
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2
    const cx = Math.cos(t)
    const cy = Math.sin(t)
    const n: V3 = [u[0] * cx + v[0] * cy + a[0] * slope, u[1] * cx + v[1] * cy + a[1] * slope, u[2] * cx + v[2] * cy + a[2] * slope]
    const l = Math.hypot(n[0], n[1], n[2]) || 1
    const nn: V3 = [n[0] / l, n[1] / l, n[2] / l]
    ringB.push(md.vertex(at(base, a, 0, u, cx * rBase, v, cy * rBase), nn))
    ringE.push(md.vertex(at(base, a, len, u, cx * rEnd, v, cy * rEnd), nn))
  }
  for (let i = 0; i < seg; i++)
    md.quad(ringB[i]!, ringB[i + 1]!, ringE[i + 1]!, ringE[i]!)

  const cap = (t: number, r: number, dir: number) => {
    const n: V3 = [a[0] * dir, a[1] * dir, a[2] * dir]
    const c = md.vertex(at(base, a, t, u, 0, v, 0), n)
    const ring: number[] = []
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2
      ring.push(md.vertex(at(base, a, t, u, Math.cos(th) * r, v, Math.sin(th) * r), n))
    }
    for (let i = 0; i < seg; i++) md.tri(c, ring[i]!, ring[i + 1]!)
  }
  if (caps === 'both' && rBase > 1e-6)
    cap(0, rBase, -1)
  if ((caps === 'both' || caps === 'end') && rEnd > 1e-6)
    cap(len, rEnd, 1)
}

/** Flat circular decal facing +/- axis, used for pin holes and cap markings. */
export function addDisc(md: MeshData, axis: Axis, centre: V3, dir: 1 | -1, radius: number, seg = 8): void {
  const { a, u, v } = basis(axis)
  const n: V3 = [a[0] * dir, a[1] * dir, a[2] * dir]
  const c = md.vertex(centre, n)
  const ring: number[] = []
  for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * Math.PI * 2
    ring.push(md.vertex(at(centre, a, 0, u, Math.cos(th) * radius, v, Math.sin(th) * radius), n))
  }
  for (let i = 0; i < seg; i++) md.tri(c, ring[i]!, ring[i + 1]!)
}

/**
 * Surface of revolution about an axis parallel to X through (cy, cz). `profile` is a polyline of
 * [radius, x]. Segment normals are blended where the profile turns gently and creased where it turns sharply.
 */
export function addLathe(md: MeshData, cy: number, cz: number, profile: ReadonlyArray<readonly [number, number]>, seg: number): void {
  const n = profile.length - 1
  if (n < 1)
    return
  const segNormals: Array<[number, number]> = []
  for (let s = 0; s < n; s++) {
    const dr = profile[s + 1]![0] - profile[s]![0]
    const dx = profile[s + 1]![1] - profile[s]![1]
    const l = Math.hypot(dr, dx) || 1
    segNormals.push([dx / l, -dr / l])
  }
  const endNormal = (s: number, atEnd: boolean): [number, number] => {
    const own = segNormals[s]!
    const other = segNormals[atEnd ? s + 1 : s - 1]
    if (!other || own[0] * other[0] + own[1] * other[1] < 0.6)
      return own
    const m: [number, number] = [own[0] + other[0], own[1] + other[1]]
    const l = Math.hypot(m[0], m[1]) || 1
    return [m[0] / l, m[1] / l]
  }
  const ring = (r: number, x: number, nr: number, nx: number): number[] => {
    const out: number[] = []
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2
      const c = Math.cos(th)
      const sn = Math.sin(th)
      out.push(md.vertex([x, cy + r * c, cz + r * sn], [nx, nr * c, nr * sn]))
    }
    return out
  }
  for (let s = 0; s < n; s++) {
    const [r0, x0] = profile[s]!
    const [r1, x1] = profile[s + 1]!
    const n0 = endNormal(s, false)
    const n1 = endNormal(s, true)
    const a = ring(r0, x0, n0[0], n0[1])
    const b = ring(r1, x1, n1[0], n1[1])
    for (let i = 0; i < seg; i++) md.quad(a[i]!, a[i + 1]!, b[i + 1]!, b[i]!)
  }
}

/**
 * Extrude a convex polygon. `map` places polygon point (a, b) at extrusion offset w in 3D.
 * Faces are flat shaded.
 */
export function addPrism(md: MeshData, loop: ReadonlyArray<readonly [number, number]>, map: (a: number, b: number, w: number) => V3, w0: number, w1: number): void {
  const A = loop.map(([a, b]) => map(a, b, w0))
  const B = loop.map(([a, b]) => map(a, b, w1))
  const all = [...A, ...B]
  const c: [number, number, number] = [0, 0, 0]
  for (const p of all) {
    c[0] += p[0] / all.length
    c[1] += p[1] / all.length
    c[2] += p[2] / all.length
  }
  const face = (pts: V3[]) => {
    // Normal from the first three points, oriented away from the solid's centre.
    const [p0, p1, p2] = [pts[0]!, pts[1]!, pts[2]!]
    const e1: V3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]
    const e2: V3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]
    let nx = e1[1] * e2[2] - e1[2] * e2[1]
    let ny = e1[2] * e2[0] - e1[0] * e2[2]
    let nz = e1[0] * e2[1] - e1[1] * e2[0]
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l
    ny /= l
    nz /= l
    const dirOut = (p0[0] - c[0]) * nx + (p0[1] - c[1]) * ny + (p0[2] - c[2]) * nz
    if (dirOut < 0) {
      nx = -nx
      ny = -ny
      nz = -nz
    }
    const idx = pts.map(p => md.vertex(p, [nx, ny, nz]))
    for (let i = 1; i < idx.length - 1; i++) md.tri(idx[0]!, idx[i]!, idx[i + 1]!)
  }
  face(A)
  face(B)
  for (let i = 0; i < loop.length; i++) {
    const j = (i + 1) % loop.length
    face([A[i]!, A[j]!, B[j]!, B[i]!])
  }
}

/** Triangle count of any geometry. */
export function triangleCount(geo: THREE.BufferGeometry): number {
  const index = geo.getIndex()
  return (index ? index.count : geo.getAttribute('position').count) / 3
}
