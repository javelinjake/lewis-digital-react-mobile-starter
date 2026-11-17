/**
 * Smart camera director. Chooses among authored safe camera volumes and only changes on broad straights or
 * stable airborne sections, never more than once every four seconds, and never near tight bends, under
 * heavy steering, close to a hazard, while recovering from a collision or when visibility is poor.
 * A lock keeps whatever view is showing.
 */
import type { CameraVolume } from '../env/types'
import type { V3 } from '../math'
import type { VehicleState } from '../vehicle/sim'
import type { LiveCameraMode, RigPreset } from './rig'
import { mixPreset, RIG_PRESETS } from './rig'

export const SMART_MIN_INTERVAL = 4
export const SMART_BLEND_SECONDS = 1

export interface SmartContext {
  state: VehicleState
  /** Smoothed steering magnitude, 0..1. */
  steer: number
  /** Seconds since the last collision. */
  sinceCollision: number
  /** Metres to the nearest wall or prop ahead. */
  hazardAhead: number
  /** Camera obstruction from the rig, 0..1. */
  obstruction: number
}

function inVolume(v: CameraVolume, p: V3) {
  return p[0] >= v.min[0] && p[0] <= v.max[0] && p[1] >= v.min[1] && p[1] <= v.max[1] && p[2] >= v.min[2] && p[2] <= v.max[2]
}

export type SmartBlock = 'steering' | 'bend' | 'hazard' | 'collision' | 'visibility' | 'interval' | 'lock' | 'slow'

export class SmartDirector {
  private from: LiveCameraMode = 'chase'
  private to: LiveCameraMode = 'chase'
  private blend = 1
  private sinceChange = SMART_MIN_INTERVAL
  locked = false
  /** Why the last evaluation did not switch (for tests and a subtle HUD hint). */
  lastBlock: SmartBlock | null = null

  constructor(private readonly volumes: readonly CameraVolume[], start: LiveCameraMode = 'chase') {
    this.from = start
    this.to = start
  }

  get mode(): LiveCameraMode {
    return this.to
  }

  setLock(locked: boolean): void {
    this.locked = locked
  }

  /** Smoothly blended preset for this frame. */
  update(dt: number, ctx: SmartContext): RigPreset {
    this.sinceChange += dt
    this.blend = Math.min(1, this.blend + dt / SMART_BLEND_SECONDS)
    const wanted = this.volumes.find(v => inVolume(v, ctx.state.pos))?.preset ?? this.to
    this.lastBlock = null
    if (wanted !== this.to) {
      const block = this.blocker(ctx)
      if (block) {
        this.lastBlock = block
      }
      else {
        this.from = this.blend >= 1 ? this.to : this.from
        this.to = wanted
        this.blend = 0
        this.sinceChange = 0
      }
    }
    const t = this.blend * this.blend * (3 - 2 * this.blend)
    return mixPreset(RIG_PRESETS[this.from], RIG_PRESETS[this.to], t)
  }

  private blocker(ctx: SmartContext): SmartBlock | null {
    const s = ctx.state
    if (this.locked)
      return 'lock'
    if (this.sinceChange < SMART_MIN_INTERVAL)
      return 'interval'
    if (ctx.steer > 0.55)
      return 'steering'
    if (Math.abs(s.yawRate) > 0.9)
      return 'bend'
    if (ctx.hazardAhead < 3)
      return 'hazard'
    if (ctx.sinceCollision < 2)
      return 'collision'
    if (ctx.obstruction > 0.35)
      return 'visibility'
    // Only on broad straights or stable airborne sections, not while crawling.
    if (!s.airborne && s.speed < 0.5)
      return 'slow'
    return null
  }
}
