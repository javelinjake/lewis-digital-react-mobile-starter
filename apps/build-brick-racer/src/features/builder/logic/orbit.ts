/**
 * Camera maths for the builder viewport. Pure functions so gestures can be unit tested.
 * Position = target + distance * (sin(yaw)cos(pitch), sin(pitch), cos(yaw)cos(pitch)).
 */
import type { Forward } from '@/game/build/types'
import type { V3 } from '@/game/math'
import { FORWARD_VECTORS } from '@/game/build/types'

export interface OrbitState {
  target: V3
  yaw: number
  pitch: number
  distance: number
}

export type ViewPreset = 'threeQuarter' | 'front' | 'side' | 'top'

export const PITCH_MIN = 0.04
export const PITCH_MAX = 1.52
export const DIST_MIN = 0.22
export const DIST_MAX = 8

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function cameraPosition(s: OrbitState): V3 {
  const cp = Math.cos(s.pitch)
  return [
    s.target[0] + s.distance * Math.sin(s.yaw) * cp,
    s.target[1] + s.distance * Math.sin(s.pitch),
    s.target[2] + s.distance * Math.cos(s.yaw) * cp,
  ]
}

/** One-finger or mouse drag. Dragging right swings the view left, dragging down lifts the camera. */
export function orbitBy(s: OrbitState, dxPx: number, dyPx: number, sensitivity = 0.0085): OrbitState {
  return { ...s, yaw: s.yaw - dxPx * sensitivity, pitch: clamp(s.pitch + dyPx * sensitivity, PITCH_MIN, PITCH_MAX) }
}

/** Pinch or wheel. `ratio` > 1 zooms in. */
export function zoomBy(s: OrbitState, ratio: number): OrbitState {
  return { ...s, distance: clamp(s.distance / Math.max(0.05, ratio), DIST_MIN, DIST_MAX) }
}

/** Two-finger drag: slide the target in the camera plane. */
export function panBy(s: OrbitState, dxPx: number, dyPx: number, viewportHeightPx: number, fovDeg: number): OrbitState {
  const perPx = (2 * s.distance * Math.tan((fovDeg * Math.PI) / 360)) / Math.max(1, viewportHeightPx)
  const right: V3 = [Math.cos(s.yaw), 0, -Math.sin(s.yaw)]
  const up: V3 = [-Math.sin(s.yaw) * Math.sin(s.pitch), Math.cos(s.pitch), -Math.cos(s.yaw) * Math.sin(s.pitch)]
  return {
    ...s,
    target: [
      s.target[0] + (-dxPx * right[0] + dyPx * up[0]) * perPx,
      s.target[1] + (-dxPx * right[1] + dyPx * up[1]) * perPx,
      s.target[2] + (-dxPx * right[2] + dyPx * up[2]) * perPx,
    ],
  }
}

export interface Bounds {
  min: V3
  max: V3
}

export const EMPTY_BOUNDS: Bounds = { min: [-0.15, 0, -0.15], max: [0.15, 0.1, 0.15] }

const centreOf = (b: Bounds): V3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]

/** Orbit state that frames the car. `top` puts the car's front toward the top of the screen. */
export function framePreset(kind: ViewPreset, bounds: Bounds, forward: Forward, fovDeg: number, aspect: number): OrbitState {
  const f = FORWARD_VECTORS[forward]
  // Left of the car when it faces `f`, matching the physics body frame.
  const l: V3 = [f[2], 0, -f[0]]
  const target = centreOf(bounds)
  const size = Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2])
  const vFov = (fovDeg * Math.PI) / 180
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  const fit = Math.min(vFov, hFov)
  const distance = clamp((size / 2 / Math.sin(fit / 2)) * 0.8, 0.55, DIST_MAX)
  let dir: V3
  let pitch: number
  switch (kind) {
    case 'front':
      dir = [f[0], 0, f[2]]
      pitch = 0.12
      break
    case 'side':
      dir = [l[0], 0, l[2]]
      pitch = 0.12
      break
    case 'top':
      dir = [-f[0], 0, -f[2]]
      pitch = PITCH_MAX
      break
    default:
      dir = [f[0] * 0.9 + l[0] * 0.8, 0, f[2] * 0.9 + l[2] * 0.8]
      pitch = 0.5
  }
  return { target, yaw: Math.atan2(dir[0], dir[2]), pitch, distance }
}

function wrap(a: number) {
  let r = a
  while (r > Math.PI) r -= Math.PI * 2
  while (r < -Math.PI) r += Math.PI * 2
  return r
}

export function lerpOrbit(a: OrbitState, b: OrbitState, t: number): OrbitState {
  const k = clamp(t, 0, 1)
  return {
    target: [a.target[0] + (b.target[0] - a.target[0]) * k, a.target[1] + (b.target[1] - a.target[1]) * k, a.target[2] + (b.target[2] - a.target[2]) * k],
    yaw: a.yaw + wrap(b.yaw - a.yaw) * k,
    pitch: a.pitch + (b.pitch - a.pitch) * k,
    distance: a.distance + (b.distance - a.distance) * k,
  }
}

export const toPose = (s: OrbitState) => ({ yaw: s.yaw, pitch: s.pitch, distance: s.distance, target: [s.target[0], s.target[1], s.target[2]] as [number, number, number] })
export const fromPose = (p: { yaw: number, pitch: number, distance: number, target: [number, number, number] }): OrbitState => ({ yaw: p.yaw, pitch: clamp(p.pitch, PITCH_MIN, PITCH_MAX), distance: clamp(p.distance, DIST_MIN, DIST_MAX), target: p.target })
