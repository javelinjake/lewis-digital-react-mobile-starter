/** Small vector / quaternion helpers. Tuples keep saved data and Rapier calls allocation-light. */
export type V3 = readonly [number, number, number]
/** Quaternion as x, y, z, w. */
export type Q4 = readonly [number, number, number, number]

export const ZERO: V3 = [0, 0, 0]
export const UP: V3 = [0, 1, 0]
export const IDENTITY_Q: Q4 = [0, 0, 0, 1]

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export function cross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}
export const length = (a: V3): number => Math.hypot(a[0], a[1], a[2])
export const distance = (a: V3, b: V3): number => length(sub(a, b))
export function normalize(a: V3): V3 {
  const l = length(a)
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]
}
export function lerp3(a: V3, b: V3, t: number): V3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
export const isFiniteV3 = (a: V3): boolean => Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2])
export const deg = (r: number): number => (r * 180) / Math.PI
export const rad = (d: number): number => (d * Math.PI) / 180

export function qMul(a: Q4, b: Q4): Q4 {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

export const qConj = (q: Q4): Q4 => [-q[0], -q[1], -q[2], q[3]]

export function qNormalize(q: Q4): Q4 {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

export function qFromAxisAngle(axis: V3, angle: number): Q4 {
  const s = Math.sin(angle / 2)
  const n = normalize(axis)
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(angle / 2)]
}

export const qFromYaw = (yaw: number): Q4 => qFromAxisAngle(UP, yaw)

/** Rotate vector by quaternion. */
export function qRotate(q: Q4, v: V3): V3 {
  const [qx, qy, qz, qw] = q
  const tx = 2 * (qy * v[2] - qz * v[1])
  const ty = 2 * (qz * v[0] - qx * v[2])
  const tz = 2 * (qx * v[1] - qy * v[0])
  return [
    v[0] + qw * tx + (qy * tz - qz * ty),
    v[1] + qw * ty + (qz * tx - qx * tz),
    v[2] + qw * tz + (qx * ty - qy * tx),
  ]
}

export const qRotateInv = (q: Q4, v: V3): V3 => qRotate(qConj(q), v)

export function qSlerp(a: Q4, b: Q4, t: number): Q4 {
  let [bx, by, bz, bw] = b
  let c = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw
  if (c < 0) {
    c = -c
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }
  if (c > 0.9995) {
    return qNormalize([
      a[0] + (bx - a[0]) * t,
      a[1] + (by - a[1]) * t,
      a[2] + (bz - a[2]) * t,
      a[3] + (bw - a[3]) * t,
    ])
  }
  const theta = Math.acos(c)
  const s = Math.sin(theta)
  const wa = Math.sin((1 - t) * theta) / s
  const wb = Math.sin(t * theta) / s
  return [a[0] * wa + bx * wb, a[1] * wa + by * wb, a[2] * wa + bz * wb, a[3] * wa + bw * wb]
}

/** Yaw (rotation about +Y) of a direction on the horizontal plane, 0 = +Z forward. */
export const yawOfDirection = (d: V3): number => Math.atan2(d[0], d[2])

export function wrapAngle(a: number): number {
  let r = a
  while (r > Math.PI) r -= Math.PI * 2
  while (r < -Math.PI) r += Math.PI * 2
  return r
}

/** Symmetric 3x3 helpers used for inertia. Row-major 9 element arrays. */
export type M3 = readonly [number, number, number, number, number, number, number, number, number]

export function m3Inverse(m: M3): M3 {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-18)
    return [0, 0, 0, 0, 0, 0, 0, 0, 0]
  const inv = 1 / det
  return [
    A * inv,
    -(b * i - c * h) * inv,
    (b * f - c * e) * inv,
    B * inv,
    (a * i - c * g) * inv,
    -(a * f - c * d) * inv,
    C * inv,
    -(a * h - b * g) * inv,
    (a * e - b * d) * inv,
  ]
}

export function m3Mul(m: M3, v: V3): V3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}

/** Jacobi eigen-decomposition of a symmetric matrix: principal moments and a rotation to the principal frame. */
export function eigenSymmetric(m: M3): { values: V3, rotation: Q4 } {
  const a = [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]]
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  for (let sweep = 0; sweep < 24; sweep++) {
    let off = 0
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) off += Math.abs(a[p]![q]!)
    }
    if (off < 1e-14)
      break
    for (let p = 0; p < 2; p++) {
      for (let q = p + 1; q < 3; q++) {
        const apq = a[p]![q]!
        if (Math.abs(apq) < 1e-18)
          continue
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * apq)
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < 3; k++) {
          const akp = a[k]![p]!
          const akq = a[k]![q]!
          a[k]![p] = c * akp - s * akq
          a[k]![q] = s * akp + c * akq
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p]![k]!
          const aqk = a[q]![k]!
          a[p]![k] = c * apk - s * aqk
          a[q]![k] = s * apk + c * aqk
        }
        for (let k = 0; k < 3; k++) {
          const vkp = v[k]![p]!
          const vkq = v[k]![q]!
          v[k]![p] = c * vkp - s * vkq
          v[k]![q] = s * vkp + c * vkq
        }
      }
    }
  }
  return { values: [a[0]![0]!, a[1]![1]!, a[2]![2]!], rotation: matrixToQuat(v as number[][]) }
}

function matrixToQuat(r: number[][]): Q4 {
  const m00 = r[0]![0]!
  const m11 = r[1]![1]!
  const m22 = r[2]![2]!
  const tr = m00 + m11 + m22
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    return qNormalize([(r[2]![1]! - r[1]![2]!) / s, (r[0]![2]! - r[2]![0]!) / s, (r[1]![0]! - r[0]![1]!) / s, s / 4])
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    return qNormalize([s / 4, (r[0]![1]! + r[1]![0]!) / s, (r[0]![2]! + r[2]![0]!) / s, (r[2]![1]! - r[1]![2]!) / s])
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    return qNormalize([(r[0]![1]! + r[1]![0]!) / s, s / 4, (r[1]![2]! + r[2]![1]!) / s, (r[0]![2]! - r[2]![0]!) / s])
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2
  return qNormalize([(r[0]![2]! + r[2]![0]!) / s, (r[1]![2]! + r[2]![1]!) / s, s / 4, (r[1]![0]! - r[0]![1]!) / s])
}

/** Orientation from pitch (about X), yaw (about Y) and roll (about Z), applied roll -> pitch -> yaw. */
export function qFromEuler(pitch: number, yaw: number, roll = 0): Q4 {
  const qy = qFromAxisAngle([0, 1, 0], yaw)
  const qx = qFromAxisAngle([1, 0, 0], pitch)
  const qz = qFromAxisAngle([0, 0, 1], roll)
  return qMul(qy, qMul(qx, qz))
}
