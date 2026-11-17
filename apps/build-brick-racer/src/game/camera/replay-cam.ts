/** Replay cameras: side, low tracking, overhead, chase and an automatic mode that favours event shots. */
import type { ReplayShot } from '../env/types'
import type { V3 } from '../math'
import type { ReplayFrame } from '../replay/player'
import type { ReplayEvent } from '../replay/types'
import type { CameraPose } from './rig'
import { add, distance, lerp3, qRotate, scale } from '../math'

export type ReplayCameraMode = 'auto' | 'chase' | 'side' | 'top' | 'low'

export interface ReplayCamContext {
  frame: ReplayFrame
  /** Car size in metres (width, height, length). */
  carSize: V3
  events: readonly ReplayEvent[]
  shots: readonly ReplayShot[]
  mode: ReplayCameraMode
  reducedMotion: boolean
}

const unitOf = (s: V3) => Math.max(0.5, s[2], s[0] * 1.4, s[1] * 1.2)

function eventNear(events: readonly ReplayEvent[], t: number, window = 1.2): ReplayEvent | null {
  let best: ReplayEvent | null = null
  for (const e of events) {
    if (e.type !== 'airborne' && e.type !== 'impact' && e.type !== 'finish' && e.type !== 'wall')
      continue
    if (Math.abs(e.t - t) <= window && (!best || Math.abs(e.t - t) < Math.abs(best.t - t)))
      best = e
  }
  return best
}

/** Resolve `auto` to a concrete shot kind for the moment, never switching faster than the caller smooths. */
export function resolveAuto(ctx: ReplayCamContext): Exclude<ReplayCameraMode, 'auto'> | { shot: ReplayShot } {
  const e = eventNear(ctx.events, ctx.frame.t)
  if (e?.type === 'airborne' || e?.type === 'finish') {
    const shot = ctx.shots
      .filter(s => s.near === (e.type === 'finish' ? 'finish' : 'jump'))
      .sort((a, b) => distance(a.position, ctx.frame.pos) - distance(b.position, ctx.frame.pos))[0]
    if (shot && distance(shot.position, ctx.frame.pos) < 18)
      return { shot }
  }
  if (e?.type === 'impact' || e?.type === 'wall')
    return 'side'
  return 'chase'
}

export function replayPose(ctx: ReplayCamContext): CameraPose {
  const u = unitOf(ctx.carSize)
  const f = ctx.frame
  const fwd = qRotate(f.quat, [0, 0, 1])
  const right = qRotate(f.quat, [-1, 0, 0])
  const pos = f.pos
  let mode = ctx.mode
  if (mode === 'auto') {
    const choice = resolveAuto(ctx)
    if (typeof choice === 'object')
      return { position: choice.shot.position, target: lerp3(choice.shot.target, pos, 0.85), fov: 52 }
    mode = choice
  }
  switch (mode) {
    case 'side':
      return { position: add(pos, add(scale(right, 3.2 * u), [0, 0.7 * u, 0])), target: add(pos, [0, 0.1 * u, 0]), fov: 50 }
    case 'top':
      return { position: add(pos, [0, 8 * u, 0.01]), target: pos, fov: 50 }
    case 'low':
      return { position: add(add(pos, scale(fwd, -2.2 * u)), add(scale(right, 1.1 * u), [0, 0.18 * u, 0])), target: add(pos, [0, 0.2 * u, 0]), fov: 62 }
    default:
      return { position: add(add(pos, scale(fwd, -3 * u)), [0, 1.2 * u, 0]), target: add(pos, scale(fwd, 0.5 * u)), fov: 58 }
  }
}
