import type { ChallengeDefinition } from '@/game/challenges/types'
import type { RunState } from '@/game/challenges/rules/types'
import type { VehicleState } from '@/game/vehicle/sim'

/** Elapsed time as `mm:ss.t`. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const rest = s - m * 60
  return `${String(m).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`
}

/**
 * Speed readout. Values are game metres per second at toy scale (see game/units.ts): 1 stud is 5 cm, so
 * 4 m/s is about 80 studs per second. There is no conversion to full-size vehicle speed.
 */
export const formatSpeed = (v: number): string => Math.max(0, v).toFixed(1)

/** Gauge runs from 0 to 1.5x the target speed so the target sits mid-way. */
const GAUGE_MAX = 1.5

export interface SpeedBand {
  /** Target band edges as 0..1 positions along the gauge. */
  lo: number
  hi: number
  marker: number
  inside: boolean
  target: number
}

export function speedBand(speed: number, target: number, tolerance: number): SpeedBand {
  const lo = Math.max(0, 1 - tolerance)
  const hi = 1 + tolerance
  const ratio = target > 0 ? speed / target : 0
  return {
    lo: lo / GAUGE_MAX,
    hi: hi / GAUGE_MAX,
    marker: Math.max(0, Math.min(1, ratio / GAUGE_MAX)),
    inside: ratio >= lo && ratio <= hi,
    target,
  }
}

export interface Cue {
  kind: 'none' | 'band' | 'text'
  title: string
  detail: string
  band?: SpeedBand
  /** Highlights the cue (for example a scoring slide). */
  active?: boolean
}

const NONE: Cue = { kind: 'none', title: '', detail: '' }

/** Rule-specific HUD cue derived from the live challenge state. */
export function cueFor(def: ChallengeDefinition | null, run: RunState | null, state: VehicleState): Cue {
  if (!def || !run)
    return NONE
  const rule = def.rule
  switch (rule.kind) {
    case 'brake_test': {
      if (run.hud.entered) {
        const entry = run.metrics.entrySpeed
        const braking = typeof run.hud.distance === 'number'
        return {
          kind: 'text',
          title: braking ? 'Stopping…' : 'Brake in the box!',
          detail: `${entry !== undefined ? `Entry ${formatSpeed(entry)} m/s` : ''}${braking ? ` · ${(run.hud.distance as number).toFixed(2)} m` : ''}`.trim(),
        }
      }
      return {
        kind: 'band',
        title: `Enter at ${formatSpeed(rule.targetEntrySpeed)} m/s`,
        detail: `Stay in the green (±${Math.round(rule.tolerance * 100)}%)`,
        band: speedBand(state.speed, rule.targetEntrySpeed, rule.tolerance),
      }
    }
    case 'coast': {
      if (run.hud.entered) {
        return { kind: 'text', title: 'Motor off — coast!', detail: `Entry ${formatSpeed(run.metrics.entrySpeed ?? 0)} m/s` }
      }
      return {
        kind: 'band',
        title: `Reach ${formatSpeed(rule.targetEntrySpeed)} m/s at the gate`,
        detail: `Stay in the green (±${Math.round(rule.tolerance * 100)}%)`,
        band: speedBand(state.speed, rule.targetEntrySpeed, rule.tolerance),
      }
    }
    case 'target_speed':
      return { kind: 'band', title: `Reach ${formatSpeed(rule.targetSpeed)} m/s`, detail: 'Hold it for a moment', band: speedBand(state.forwardSpeed, rule.targetSpeed, 0) }
    case 'drift': {
      const slip = typeof run.hud.slip === 'number' ? run.hud.slip : 0
      const sliding = run.hud.sliding === true
      return {
        kind: 'text',
        title: sliding ? 'Sliding!' : 'Slide the corner',
        detail: `Slip ${Math.round(slip)}° · Score ${Math.round(run.metrics.driftScore ?? 0)}`,
        active: sliding,
      }
    }
    case 'jump': {
      const air = typeof run.hud.airtime === 'number' ? run.hud.airtime : 0
      return { kind: 'text', title: state.airborne ? 'Airborne!' : 'Launch from the plank', detail: air > 0 ? `Air ${air.toFixed(1)} s` : '', active: state.airborne }
    }
    default:
      return NONE
  }
}
