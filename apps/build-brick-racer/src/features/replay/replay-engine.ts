/**
 * Replay playback. Plays the recorded samples of the actual run (transforms, wheel poses and events) through
 * an interpolating player. Nothing is re-simulated, so the replay shows exactly what happened on the device
 * that recorded it, including collisions, resets and the finish.
 */
import type { ChallengeDefinition } from '@/game/challenges/types'
import type { EnvironmentDefinition } from '@/game/env/types'
import type { CameraPose } from '@/game/camera/rig'
import type { ReplayCameraMode } from '@/game/camera/replay-cam'
import type { ReplayRecord } from '@/game/replay/types'
import type { VehicleSpec } from '@/game/vehicle/compile'
import type { CarDocument } from '@/game/build/types'
import type { CarModel, SceneKit } from '@/render'
import { catalog } from '@/game/catalog/catalog'
import { replayPose } from '@/game/camera/replay-cam'
import { ReplayPlayer } from '@/game/replay/player'
import { buildDrivingCarModel, buildEnvironment, createSceneKit } from '@/render'
import { advanceTime } from './scrubber-math'

export interface ReplayEngineOptions {
  canvas: HTMLCanvasElement
  doc: CarDocument
  spec: VehicleSpec
  env: EnvironmentDefinition
  challenge: ChallengeDefinition | null
  record: ReplayRecord
  reducedMotion: boolean
  /** Called ~15 times a second with the playback time (written to the DOM by the screen, not React state). */
  onTick: (t: number) => void
  onPlayState: (playing: boolean) => void
}

export class ReplayEngine {
  time = 0
  playing = true
  speed = 1
  mode: ReplayCameraMode = 'auto'
  readonly duration: number
  readonly player: ReplayPlayer
  private readonly kit: SceneKit
  private readonly car: CarModel
  private readonly env: ReturnType<typeof buildEnvironment>
  private camPos: [number, number, number] | null = null
  private camTarget: [number, number, number] = [0, 0, 0]
  private camFov = 58
  private raf = 0
  private last = 0
  private tickClock = 0
  private disposed = false
  readonly frameTimes: number[] = []

  constructor(private readonly o: ReplayEngineOptions) {
    this.player = new ReplayPlayer(o.record)
    this.duration = o.record.duration
    this.kit = createSceneKit(o.canvas, { quality: 'high', shadows: true })
    this.env = buildEnvironment(o.env, o.challenge ?? undefined)
    this.kit.scene.add(this.env.root)
    this.env.apply(this.kit.scene)
    this.kit.setFog(o.env.fogColour, 30, o.env.fogFar)
    this.car = buildDrivingCarModel(o.doc, o.spec, catalog)
    this.kit.scene.add(this.car.root)
    this.last = performance.now()
    this.applyFrame(0)
    this.raf = requestAnimationFrame(this.frame)
  }

  play(): void {
    if (this.time >= this.duration)
      this.time = 0
    this.playing = true
    this.last = performance.now()
    this.o.onPlayState(true)
  }

  pause(): void {
    this.playing = false
    this.o.onPlayState(false)
  }

  restart(): void {
    this.time = 0
    this.camPos = null
    this.play()
  }

  seek(t: number): void {
    this.time = Math.min(Math.max(0, t), this.duration)
    this.camPos = null
    this.applyFrame(0)
    this.o.onTick(this.time)
  }

  setSpeed(s: number): void {
    this.speed = s
  }

  setMode(mode: ReplayCameraMode): void {
    this.mode = mode
    // Reduced motion cuts straight to the new view instead of gliding.
    if (this.o.reducedMotion)
      this.camPos = null
  }

  private frame = (now: number): void => {
    if (this.disposed)
      return
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.frameTimes.push((now - this.last))
    if (this.frameTimes.length > 600)
      this.frameTimes.shift()
    this.last = now
    if (this.playing) {
      const next = advanceTime(this.time, dt, this.speed, this.duration)
      this.time = next.t
      if (next.ended) {
        this.playing = false
        this.o.onPlayState(false)
      }
    }
    this.applyFrame(dt)
    this.tickClock += dt
    if (this.tickClock > 1 / 15) {
      this.tickClock = 0
      this.o.onTick(this.time)
    }
    this.kit.render()
  }

  private applyFrame(dt: number): void {
    const frame = this.player.at(this.time)
    if (!frame)
      return
    this.car.root.position.set(frame.pos[0], frame.pos[1], frame.pos[2])
    this.car.root.quaternion.set(frame.quat[0], frame.quat[1], frame.quat[2], frame.quat[3])
    this.car.update(frame.wheels)
    this.car.root.updateMatrixWorld()
    const pose = replayPose({
      frame,
      carSize: this.o.spec.size,
      events: this.o.record.events,
      shots: this.o.env.replayShots,
      mode: this.mode,
      reducedMotion: this.o.reducedMotion,
    })
    this.applyCamera(pose, dt)
    this.kit.followSun(frame.pos)
  }

  private applyCamera(pose: CameraPose, dt: number): void {
    const cut = this.o.reducedMotion || this.camPos === null || dt === 0
    const k = cut ? 1 : 1 - Math.exp(-dt / 0.2)
    if (this.camPos === null) {
      this.camPos = [pose.position[0], pose.position[1], pose.position[2]]
      this.camTarget = [pose.target[0], pose.target[1], pose.target[2]]
      this.camFov = pose.fov
    }
    else {
      for (let i = 0; i < 3; i++) {
        this.camPos[i] = this.camPos[i]! + (pose.position[i]! - this.camPos[i]!) * k
        this.camTarget[i] = this.camTarget[i]! + (pose.target[i]! - this.camTarget[i]!) * k
      }
      this.camFov += (pose.fov - this.camFov) * k
    }
    const cam = this.kit.camera
    cam.position.set(this.camPos[0], this.camPos[1], this.camPos[2])
    cam.lookAt(this.camTarget[0], this.camTarget[1], this.camTarget[2])
    if (Math.abs(cam.fov - this.camFov) > 0.01) {
      cam.fov = this.camFov
      cam.updateProjectionMatrix()
    }
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.car.dispose()
    this.env.dispose()
    this.kit.dispose()
  }
}
