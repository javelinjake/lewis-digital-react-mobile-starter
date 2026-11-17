import type { V3 } from '../math'
import type { DriftZone, Gate, ZoneBox } from './types'
import { dot, wrapAngle } from '../math'

/** If the segment a->b crosses the gate plane in its travel direction inside its bounds, returns the crossing fraction. */
export function crossesGate(g: Gate, a: V3, b: V3): number | null {
  const n: V3 = [Math.sin(g.yaw), 0, Math.cos(g.yaw)]
  const lateral: V3 = [Math.cos(g.yaw), 0, -Math.sin(g.yaw)]
  const da = dot([a[0] - g.centre[0], a[1] - g.centre[1], a[2] - g.centre[2]], n)
  const db = dot([b[0] - g.centre[0], b[1] - g.centre[1], b[2] - g.centre[2]], n)
  if (!(da < 0 && db >= 0))
    return null
  const t = da === db ? 0 : -da / (db - da)
  const q: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  const rel: V3 = [q[0] - g.centre[0], q[1] - g.centre[1], q[2] - g.centre[2]]
  if (Math.abs(dot(rel, lateral)) > g.halfWidth || Math.abs(rel[1]) > g.halfHeight)
    return null
  return t
}

export function inZone(z: ZoneBox, p: V3): boolean {
  const rel: V3 = [p[0] - z.centre[0], p[1] - z.centre[1], p[2] - z.centre[2]]
  const fwd: V3 = [Math.sin(z.yaw), 0, Math.cos(z.yaw)]
  const lat: V3 = [Math.cos(z.yaw), 0, -Math.sin(z.yaw)]
  return Math.abs(dot(rel, lat)) <= z.half[0] && Math.abs(rel[1]) <= z.half[1] && Math.abs(dot(rel, fwd)) <= z.half[2]
}

/** Polar position inside a drift corner: radius, and angle measured from the zone start. */
export function driftPolar(zone: DriftZone, p: V3): { radius: number, angle: number, inside: boolean } {
  const dx = p[0] - zone.centre[0]
  const dz = p[2] - zone.centre[1]
  const radius = Math.hypot(dx, dz)
  const angle = wrapAngle(Math.atan2(dz, dx) - zone.startAngle)
  const span = zone.endAngle - zone.startAngle
  return { radius, angle, inside: radius >= zone.inner && radius <= zone.outer && angle >= -0.02 && angle <= span }
}

export const horizontalDistance = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[2] - b[2])
