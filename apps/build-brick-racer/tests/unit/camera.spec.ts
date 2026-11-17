import type { CameraVolume } from '@/game/env/types'
import type { VehicleState } from '@/game/vehicle/sim'
import { describe, expect, it } from 'vitest'
import { replayPose } from '@/game/camera/replay-cam'
import { CameraRig, RIG_PRESETS } from '@/game/camera/rig'
import { SMART_MIN_INTERVAL, SmartDirector } from '@/game/camera/smart'
import { length, qFromYaw, sub } from '@/game/math'

function state(over: Partial<VehicleState> = {}): VehicleState {
  return {
    pos: [0, 0.3, 0],
    quat: [0, 0, 0, 1],
    vel: [0, 0, 3],
    angVel: [0, 0, 0],
    speed: 3,
    forwardSpeed: 3,
    lateralSpeed: 0,
    slipAngle: 0,
    yawRate: 0,
    upDot: 1,
    groundedWheels: 4,
    airborne: false,
    wheelspin: false,
    reversing: false,
    wheels: [],
    surface: 'tile',
    ...over,
  }
}

describe('chase cameras', () => {
  it('sits behind and above the car, scaled to the whole car including wings and tall builds', () => {
    const small = new CameraRig({ carSize: [0.4, 0.2, 0.7], reducedMotion: false })
    const big = new CameraRig({ carSize: [0.8, 0.9, 1.6], reducedMotion: false })
    const a = small.update(state(), 1, { preset: RIG_PRESETS.chase })
    const b = big.update(state(), 1, { preset: RIG_PRESETS.chase })
    expect(a.position[2]).toBeLessThan(0)
    expect(a.position[1]).toBeGreaterThan(0.3)
    expect(length(sub(b.position, b.target))).toBeGreaterThan(length(sub(a.position, a.target)) * 1.5)
  })

  it('stays behind the car when it turns and never flips to a front or reversed view', () => {
    const rig = new CameraRig({ carSize: [0.4, 0.2, 0.7], reducedMotion: false })
    rig.update(state(), 1, { preset: RIG_PRESETS.chase })
    // Car yaws a full half turn over two seconds: the camera follows, always on the car's rear side.
    for (let i = 1; i <= 120; i++) {
      const yaw = (Math.PI * i) / 120
      const q = qFromYaw(yaw)
      const pose = rig.update(state({ quat: q }), 1 / 60, { preset: RIG_PRESETS.chase })
      const heading: [number, number] = [Math.sin(yaw), Math.cos(yaw)]
      const toCamera: [number, number] = [pose.position[0], pose.position[2]]
      expect(toCamera[0] * heading[0] + toCamera[1] * heading[1]).toBeLessThan(0.05)
    }
  })

  it('does not pull back with speed under reduced motion and has no roll', () => {
    const calm = new CameraRig({ carSize: [0.4, 0.2, 0.7], reducedMotion: true })
    const lively = new CameraRig({ carSize: [0.4, 0.2, 0.7], reducedMotion: false })
    const fast = state({ speed: 8 })
    const c = calm.update(fast, 5, { preset: RIG_PRESETS.chase })
    const l = lively.update(fast, 5, { preset: RIG_PRESETS.chase })
    expect(length(sub(c.position, c.target))).toBeLessThan(length(sub(l.position, l.target)))
  })
})

describe('smart camera', () => {
  const volumes: CameraVolume[] = [
    { min: [-5, -1, -5], max: [5, 4, 10], preset: 'chase' },
    { min: [-5, -1, 10], max: [5, 4, 40], preset: 'high' },
  ]
  const calm = { steer: 0, sinceCollision: 99, hazardAhead: 50, obstruction: 0 }

  it('switches on a broad straight with a smooth blend, then waits at least four seconds', () => {
    const d = new SmartDirector(volumes)
    const at = (z: number) => state({ pos: [0, 0.3, z] })
    d.update(5, { state: at(2), ...calm })
    expect(d.mode).toBe('chase')
    d.update(0.1, { state: at(12), ...calm })
    expect(d.mode).toBe('high')
    // Immediately back into the first volume: not allowed yet.
    d.update(0.1, { state: at(2), ...calm })
    expect(d.mode).toBe('high')
    expect(d.lastBlock).toBe('interval')
    d.update(SMART_MIN_INTERVAL, { state: at(2), ...calm })
    expect(d.mode).toBe('chase')
  })

  it('suspends changes near tight bends, under heavy steering, near hazards, after a collision, or with poor visibility', () => {
    const cases: Array<[string, Partial<typeof calm> & { yaw?: number }]> = [
      ['steering', { steer: 0.9 }],
      ['bend', { yaw: 1.5 }],
      ['hazard', { hazardAhead: 1 }],
      ['collision', { sinceCollision: 0.5 }],
      ['visibility', { obstruction: 0.8 }],
    ]
    for (const [reason, over] of cases) {
      const d = new SmartDirector(volumes)
      d.update(5, { state: state({ pos: [0, 0.3, 2] }), ...calm })
      d.update(5, { state: state({ pos: [0, 0.3, 12], yawRate: over.yaw ?? 0 }), ...calm, ...over })
      expect(d.mode, reason).toBe('chase')
      expect(d.lastBlock, reason).toBe(reason === 'bend' ? 'bend' : reason)
    }
  })

  it('can be locked so the view never changes', () => {
    const d = new SmartDirector(volumes)
    d.setLock(true)
    d.update(10, { state: state({ pos: [0, 0.3, 12] }), ...calm })
    expect(d.mode).toBe('chase')
    expect(d.lastBlock).toBe('lock')
    d.setLock(false)
    d.update(0.1, { state: state({ pos: [0, 0.3, 12] }), ...calm })
    expect(d.mode).toBe('high')
  })
})

describe('replay cameras', () => {
  const frame = { pos: [1, 0.3, 5] as [number, number, number], quat: qFromYaw(0), wheels: [], t: 3 }
  const base = { frame, carSize: [0.4, 0.2, 0.7] as [number, number, number], events: [], shots: [], reducedMotion: false }

  it('provides side, top, low and chase views around the car', () => {
    const side = replayPose({ ...base, mode: 'side' })
    const top = replayPose({ ...base, mode: 'top' })
    const low = replayPose({ ...base, mode: 'low' })
    const chase = replayPose({ ...base, mode: 'chase' })
    expect(Math.abs(side.position[0] - 1)).toBeGreaterThan(1)
    expect(top.position[1]).toBeGreaterThan(3)
    expect(low.position[1]).toBeLessThan(0.6)
    expect(chase.position[2]).toBeLessThan(5)
  })

  it('auto mode prefers an authored cinematic shot near a jump', () => {
    const pose = replayPose({
      ...base,
      mode: 'auto',
      events: [{ t: 3.1, type: 'airborne' }],
      shots: [{ id: 'jump', position: [-3, 1, 6], target: [1, 0.3, 5], near: 'jump' }],
    })
    expect(pose.position).toEqual([-3, 1, 6])
  })
})
