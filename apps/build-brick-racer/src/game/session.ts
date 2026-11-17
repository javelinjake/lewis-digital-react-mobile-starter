import type { ChallengeDefinition } from './challenges/types'
import type { V3 } from './math'
import type { ReplayRecord } from './replay/types'
import type { VehicleSpec } from './vehicle/compile'
import type { RawControls } from './vehicle/input'
import type { AssistMode } from './vehicle/physics-config'
import type { Pose, SimEvent } from './vehicle/sim'
/**
 * One driving session: input ramp, simulation, challenge rules, resets and replay recording.
 * The Drive screen and the calibration tests both run through this class. Player input is the only
 * source of driving commands.
 */
import type { PhysicsWorld } from './vehicle/world'
import { FREE_DRIVE } from './challenges'
import { ChallengeRun } from './challenges/run'
import { freeDrivePose, poseOnGround, resetPose, startPose } from './challenges/spawn'
import { qRotate, yawOfDirection } from './math'
import { ReplayRecorder } from './replay/recorder'
import { InputRamp } from './vehicle/input'
import { physicsConfig } from './vehicle/physics-config'
import { VehicleSim } from './vehicle/sim'

export interface SessionOptions {
  pw: PhysicsWorld
  spec: VehicleSpec
  challenge: ChallengeDefinition | null
  assist: AssistMode
}

export class DriveSession {
  readonly sim: VehicleSim
  readonly run: ChallengeRun | null
  readonly dt = 1 / physicsConfig.tickHz
  private readonly ramp = new InputRamp()
  private readonly recorder: ReplayRecorder
  private prev
  private pendingReset = false
  /** Seconds of simulation since Go (or since the session began in free drive). */
  elapsed = 0

  constructor(private readonly o: SessionOptions) {
    const pose = o.challenge
      ? startPose(o.challenge, o.pw, o.spec)
      : freeDrivePose(o.pw, o.spec, FREE_DRIVE[o.pw.env.id])
    if (!pose)
      throw new Error('There is no ground at the start position.')
    this.sim = new VehicleSim(o.pw, o.spec, o.assist, pose)
    this.run = o.challenge ? new ChallengeRun(o.challenge, o.pw.env.killY, o.spec) : null
    this.recorder = new ReplayRecorder(o.spec.wheels.length)
    this.prev = this.sim.state
  }

  /** Let the suspension settle before Go so timing starts from a steady car. */
  settle(seconds = 0.6): void {
    for (let i = 0; i < Math.round(seconds * physicsConfig.tickHz); i++) this.sim.step({ steer: 0, throttle: 0, brake: 0, reverse: false }, false)
    this.sim.drainEvents()
    this.prev = this.sim.state
  }

  /** Go. */
  start(): void {
    this.run?.start()
    this.recorder.capture(0, this.sim.state, true)
    this.recorder.event({ t: 0, type: 'start', pos: [...this.sim.state.pos] as [number, number, number] })
  }

  get phase(): 'free' | 'ready' | 'running' | 'finished' | 'ended' {
    return this.run ? this.run.run.phase : 'free'
  }

  get active(): boolean {
    return this.run ? this.run.run.phase === 'running' : true
  }

  setAssist(mode: AssistMode): void {
    this.sim.setAssist(mode)
  }

  /** Reset button. Applied at the next tick so it never lands mid-substep. */
  requestReset(): void {
    this.pendingReset = true
  }

  /** Clears held input (focus loss, pause). */
  releaseInput(): void {
    this.ramp.reset()
  }

  /** Advance one physics tick from the player's controls. Returns events from this tick. */
  step(raw: RawControls): SimEvent[] {
    if (!this.active)
      return []
    if (this.pendingReset)
      this.doReset()

    const input = this.ramp.sample(raw, this.dt)
    const motor = this.run ? this.run.run.motorEnabled : true
    this.sim.step(input, motor, this.dt)
    const events = this.sim.drainEvents()
    this.elapsed += this.dt
    const state = this.sim.state

    for (const e of events) {
      if (e.type === 'impact') {
        this.recorder.event({ t: this.elapsed, type: 'impact', value: e.magnitude, pos: [...state.pos] as [number, number, number] })
        this.recorder.capture(this.elapsed, state, true)
      }
      else if (e.type === 'wall') {
        this.recorder.event({ t: this.elapsed, type: 'wall', pos: [...state.pos] as [number, number, number] })
      }
    }
    if (state.airborne !== this.prev.airborne) {
      this.recorder.event({ t: this.elapsed, type: state.airborne ? 'airborne' : 'land', pos: [...state.pos] as [number, number, number] })
    }

    if (this.run) {
      const before = this.run.run.gateIndex
      this.run.update({ dt: this.dt, state, prev: this.prev, input, events, spec: this.o.spec })
      if (this.run.run.gateIndex !== before)
        this.recorder.event({ t: this.elapsed, type: 'gate', value: this.run.run.gateIndex, pos: [...state.pos] as [number, number, number] })
      if (this.run.run.phase === 'finished' || this.run.run.phase === 'ended') {
        this.recorder.event({ t: this.elapsed, type: 'finish', pos: [...state.pos] as [number, number, number] })
        this.recorder.capture(this.elapsed, state, true)
      }
    }
    this.recorder.capture(this.elapsed, state)
    this.prev = state
    return events
  }

  private doReset(): void {
    this.pendingReset = false
    const { pw, spec, challenge } = this.o
    let pose: Pose | null
    if (challenge && this.run) {
      pose = resetPose(challenge, this.run.run.checkpoint, pw, spec, this.sim.rigidBody)
    }
    else {
      const s = this.sim.state
      const heading = qRotate(s.quat, [0, 0, 1])
      pose = poseOnGround(pw, spec, s.pos[0], s.pos[2], yawOfDirection(heading as V3)) ?? freeDrivePose(pw, spec, FREE_DRIVE[pw.env.id])
    }
    if (!pose)
      return
    this.recorder.markBreak()
    this.sim.reset(pose)
    this.ramp.reset()
    this.run?.noteReset()
    this.prev = this.sim.state
    this.recorder.event({ t: this.elapsed, type: 'reset', pos: [...pose.pos] as [number, number, number] })
    this.recorder.capture(this.elapsed, this.sim.state, true)
  }

  /** Finalise the replay for this attempt. */
  buildReplay(runId: string, carSnapshotId: string, pinned = false): ReplayRecord {
    return this.recorder.finish(runId, carSnapshotId, this.o.challenge?.id ?? null, this.elapsed, pinned)
  }

  dispose(): void {
    this.sim.dispose()
  }
}
