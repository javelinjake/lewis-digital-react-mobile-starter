import type { HudView } from '../hud/hud-view'
import type { ControlHub } from '../input/hub'
/**
 * The live driving runtime, outside React. One requestAnimationFrame loop advances the physics in fixed 60 Hz
 * ticks (render-rate independent), interpolates the car between ticks, updates the camera, particles, audio and
 * the HUD (written straight to the DOM). React only hears about phase changes.
 */
import type { CarDocument } from '@/game/build/types'
import type { ChallengeDefinition } from '@/game/challenges/types'
import type { EnvironmentDefinition } from '@/game/env/types'
import type { CameraChoice } from '@/game/persistence/types'
import type { VehicleSpec } from '@/game/vehicle/compile'
import type { AssistMode } from '@/game/vehicle/physics-config'
import type { SimEvent, VehicleState } from '@/game/vehicle/sim'
import type { CarModel, SceneKit, WheelPose } from '@/render'
import * as THREE from 'three'
import { catalog } from '@/game/catalog/catalog'
import { DriveSession } from '@/game/session'
import { loadRapier } from '@/game/vehicle/rapier'
import { PhysicsWorld } from '@/game/vehicle/world'
import { audio, engine as engineSound, haptics, music, sfx } from '@/lib/audio'
import { buildDrivingCarModel, buildEnvironment, createSceneKit } from '@/render'
import { writeHud } from '../hud/hud-writer'
import { FixedStepper } from '../loop/fixed-step'
import { DriveCamera } from './drive-camera'
import { EffectsDirector, ParticlePool } from './effects'

export type DrivePhase = 'countdown' | 'running' | 'paused' | 'finished'

export interface EngineCallbacks {
  onPhase: (phase: DrivePhase) => void
  /** 3, 2, 1, then 0 for Go; null when the countdown is over. */
  onCountdown: (n: number | null) => void
  onResetPrompt: (show: boolean) => void
  onCamera: (mode: CameraChoice, locked: boolean) => void
}

export interface EngineOptions {
  /** The engine creates and owns its own canvas inside this element, so a remount never shares a WebGL context. */
  host: HTMLElement
  /** Checked after the WASM physics loads, so a screen that already unmounted never builds a renderer. */
  isCancelled: () => boolean
  hud: HudView
  hub: ControlHub
  doc: CarDocument
  spec: VehicleSpec
  env: EnvironmentDefinition
  challenge: ChallengeDefinition | null
  assist: AssistMode
  camera: CameraChoice
  lock: boolean
  reducedMotion: boolean
  callbacks: EngineCallbacks
}

/** Seconds per countdown beat. Three beats plus Go keeps a repeat run under three seconds. */
const BEAT = 0.75
const HUD_INTERVAL = 1 / 15
/** If the car moves further than this in one tick it was teleported (a reset): do not interpolate across it. */
const TELEPORT = 1.5

export class DriveEngine {
  phase: DrivePhase = 'countdown'
  session!: DriveSession
  private prev!: VehicleState
  private cur!: VehicleState
  private readonly stepper = new FixedStepper(1 / 60)
  private readonly kit: SceneKit
  private readonly envMesh: ReturnType<typeof buildEnvironment>
  private readonly carModel: CarModel
  private readonly camera: DriveCamera
  private readonly effects: EffectsDirector
  private readonly poses: WheelPose[]
  private readonly tmpQ = new THREE.Quaternion()
  private readonly tmpQ2 = new THREE.Quaternion()
  private readonly tmpV = new THREE.Vector3()
  private readonly contacts: Array<{ x: number, y: number, z: number }>
  private raf = 0
  private last = 0
  private hudClock = 0
  private countdownT = 0
  private lastBeat = 4
  private beforePause: DrivePhase = 'running'
  private frameEvents: SimEvent[] = []
  private toast: string | null = null
  private toastUntil = 0
  private resetPrompt = false
  private lastResets = 0
  private lastGate = 0
  private lastRaw = { throttle: 0, steer: 0, brake: false }
  private slowFrames = 0
  private frameEma = 1 / 60
  private disposed = false
  /** Frame time samples (ms) for diagnostics. */
  readonly frameTimes: number[] = []

  private constructor(private readonly o: EngineOptions, private readonly pw: PhysicsWorld, private readonly canvas: HTMLCanvasElement) {
    const kit = createSceneKit(canvas, { quality: 'high', shadows: true })
    this.kit = kit
    this.envMesh = buildEnvironment(o.env, o.challenge ?? undefined)
    kit.scene.add(this.envMesh.root)
    this.envMesh.apply(kit.scene)
    kit.setFog(o.env.fogColour, 30, o.env.fogFar)
    this.carModel = buildDrivingCarModel(o.doc, o.spec, catalog)
    kit.scene.add(this.carModel.root)
    const pool = new ParticlePool()
    kit.scene.add(pool.points)
    this.effects = new EffectsDirector(pool)
    this.effects.enabled = !o.reducedMotion
    this.poses = o.spec.wheels.map(() => ({ steer: 0, spin: 0, offset: 0 }))
    this.contacts = o.spec.wheels.map(() => ({ x: 0, y: 0, z: 0 }))
    this.camera = new DriveCamera(o.spec, o.env.cameraVolumes, o.camera, o.lock, o.reducedMotion)
    this.buildSession()
  }

  static async create(o: EngineOptions): Promise<DriveEngine | null> {
    const R = await loadRapier()
    if (o.isCancelled())
      return null
    const pw = new PhysicsWorld(R, o.env)
    const canvas = document.createElement('canvas')
    canvas.className = 'dr-canvas'
    canvas.setAttribute('aria-label', 'Driving view')
    o.host.appendChild(canvas)
    return new DriveEngine(o, pw, canvas)
  }

  private buildSession(): void {
    this.session = new DriveSession({ pw: this.pw, spec: this.o.spec, challenge: this.o.challenge, assist: this.o.assist })
    this.session.settle()
    this.cur = this.session.sim.state
    this.prev = this.cur
    this.lastResets = 0
    this.lastGate = 0
    this.camera.snap()
    this.applyVisual(1)
    this.o.hud.invalidate()
  }

  get cameraMode(): CameraChoice {
    return this.camera.mode
  }

  get cameraLocked(): boolean {
    return this.camera.locked
  }

  get unit(): number {
    return this.camera.rig.unit
  }

  /** Begin the loop and the countdown (free drive starts immediately). */
  begin(): void {
    this.o.callbacks.onCamera(this.camera.mode, this.camera.locked)
    this.o.callbacks.onPhase('countdown')
    this.countdownT = 0
    this.lastBeat = 4
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  private setPhase(phase: DrivePhase) {
    this.phase = phase
    this.o.callbacks.onPhase(phase)
  }

  private go(): void {
    this.o.callbacks.onCountdown(0)
    sfx.countdown(0)
    this.session.start()
    this.stepper.reset()
    audio.unlock()
    engineSound.start()
    music.start()
    this.setPhase('running')
    setTimeout(() => !this.disposed && this.o.callbacks.onCountdown(null), 600)
  }

  pause(): void {
    if (this.phase !== 'running' && this.phase !== 'countdown')
      return
    this.beforePause = this.phase
    this.releaseInput()
    engineSound.stop()
    this.setPhase('paused')
  }

  resume(): void {
    if (this.phase !== 'paused')
      return
    this.releaseInput()
    this.stepper.reset()
    this.last = performance.now()
    if (this.beforePause === 'running') {
      engineSound.start()
      music.start()
    }
    this.setPhase(this.beforePause)
  }

  /** Clears every held input. Used by pause, focus loss, restart and unmount. */
  releaseInput(): void {
    this.o.hub.releaseAll()
    this.session?.releaseInput()
  }

  /** Fresh session in the same world and scene: the repeat run is ready almost immediately. */
  restart(): void {
    this.releaseInput()
    engineSound.stop()
    this.session.dispose()
    this.buildSession()
    this.toast = null
    this.resetPrompt = false
    this.o.callbacks.onResetPrompt(false)
    this.countdownT = 0
    this.lastBeat = 4
    this.last = performance.now()
    this.setPhase('countdown')
  }

  reset(): void {
    if (this.phase === 'running')
      this.session.requestReset()
  }

  cycleCamera(): void {
    this.camera.cycle()
    this.o.callbacks.onCamera(this.camera.mode, this.camera.locked)
  }

  toggleLock(): void {
    this.camera.setLock(!this.camera.locked)
    this.o.callbacks.onCamera(this.camera.mode, this.camera.locked)
  }

  setCamera(mode: CameraChoice): void {
    this.camera.mode = mode
    this.o.callbacks.onCamera(this.camera.mode, this.camera.locked)
  }

  setAssist(mode: AssistMode): void {
    this.session.setAssist(mode)
    this.session.run?.run.invalid.add('Steering help changed during the run')
  }

  private showToast(text: string, seconds = 1.6): void {
    this.toast = text
    this.toastUntil = performance.now() + seconds * 1000
  }

  /** Interpolated visual state between the last two physics ticks. */
  private applyVisual(alpha: number): VehicleState {
    const a = this.prev
    const b = this.cur
    const jumped = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]) > TELEPORT
    const t = jumped ? 1 : Math.min(1, Math.max(0, alpha))
    const root = this.carModel.root
    root.position.set(a.pos[0] + (b.pos[0] - a.pos[0]) * t, a.pos[1] + (b.pos[1] - a.pos[1]) * t, a.pos[2] + (b.pos[2] - a.pos[2]) * t)
    this.tmpQ.set(a.quat[0], a.quat[1], a.quat[2], a.quat[3])
    this.tmpQ2.set(b.quat[0], b.quat[1], b.quat[2], b.quat[3])
    root.quaternion.slerpQuaternions(this.tmpQ, this.tmpQ2, t)
    for (let i = 0; i < this.poses.length; i++) {
      const wa = a.wheels[i]
      const wb = b.wheels[i]
      const p = this.poses[i]!
      if (wa && wb) {
        p.steer = wa.steer + (wb.steer - wa.steer) * t
        p.spin = wa.spin + (wb.spin - wa.spin) * t
        p.offset = wa.offset + (wb.offset - wa.offset) * t
      }
    }
    this.carModel.update(this.poses)
    this.carModel.setBrakeLights(this.phase === 'running' && this.lastRaw.brake)
    return {
      ...b,
      pos: [root.position.x, root.position.y, root.position.z],
      quat: [root.quaternion.x, root.quaternion.y, root.quaternion.z, root.quaternion.w],
    }
  }

  private afterTick(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'impact') {
        sfx.thud(e.magnitude / 4)
        haptics.heavy()
        this.camera.noteCollision()
      }
      else if (e.type === 'wall') {
        sfx.thud(0.4)
        haptics.medium()
        this.camera.noteCollision()
      }
    }
    this.frameEvents.push(...events)
    const run = this.session.run
    if (!run)
      return
    if (run.run.resets !== this.lastResets) {
      this.lastResets = run.run.resets
      this.prev = this.cur
      this.camera.snap()
      this.showToast('Back on track — practice run')
    }
    if (run.run.gateIndex !== this.lastGate) {
      this.lastGate = run.run.gateIndex
      const total = run.def.gates.length
      const gate = run.def.gates[run.run.gateIndex - 1]
      if (gate && gate.kind === 'checkpoint') {
        this.showToast(`Checkpoint ${run.run.gateIndex} / ${total}`)
        sfx.gate()
      }
    }
    if (run.run.phase === 'finished' || run.run.phase === 'ended')
      this.finish()
  }

  private finish(): void {
    if (this.phase === 'finished')
      return
    const finished = this.session.run?.run.phase === 'finished'
    engineSound.stop()
    music.stop()
    if (finished) {
      sfx.finish()
      haptics.success()
    }
    else {
      haptics.warning()
    }
    this.releaseInput()
    this.setPhase('finished')
  }

  /** Ends a running challenge attempt early. The partial progress is kept by the caller. */
  abandon(): void {
    this.session.run?.abandon()
    this.finishQuietly()
  }

  private finishQuietly(): void {
    engineSound.stop()
    music.stop()
    this.releaseInput()
    this.phase = 'finished'
  }

  private frame = (now: number): void => {
    if (this.disposed)
      return
    this.raf = requestAnimationFrame(this.frame)
    const frameDt = (now - this.last) / 1000
    this.last = now
    const dt = Math.min(0.1, Math.max(0, frameDt))
    this.frameTimes.push(frameDt * 1000)
    if (this.frameTimes.length > 600)
      this.frameTimes.shift()
    this.monitor(dt)
    this.o.hub.poll()

    if (this.phase === 'countdown')
      this.updateCountdown(dt)

    this.frameEvents.length = 0
    if (this.phase === 'running') {
      this.stepper.advance(dt, () => {
        const raw = this.o.hub.read()
        this.prev = this.cur
        const events = this.session.step(raw)
        this.cur = this.session.sim.state
        this.lastRaw = { throttle: Math.max(raw.throttleAxis, raw.throttle ? 1 : 0), steer: raw.steerAxis || (raw.left ? -1 : raw.right ? 1 : 0), brake: raw.brake || raw.brakeAxis > 0.1 }
        this.camera.noteSteer(this.lastRaw.steer)
        this.afterTick(events)
      })
    }
    const alpha = this.phase === 'running' ? this.stepper.alpha : 1
    const view = this.applyVisual(alpha)
    this.carModel.root.updateMatrixWorld()
    this.updateContacts()
    this.effects.update(dt, view, { contacts: this.contacts }, this.frameEvents)
    this.camera.update(this.kit.camera, view, dt, this.pw, this.session.sim.rigidBody)
    this.kit.followSun(view.pos)
    this.hudTick(now, dt, view)
    this.kit.render()
  }

  private updateCountdown(dt: number): void {
    if (!this.o.challenge) {
      // Free drive has no countdown: start straight away.
      this.session.start()
      this.stepper.reset()
      audio.unlock()
      engineSound.start()
      music.start()
      this.setPhase('running')
      return
    }
    this.countdownT += dt
    const beat = Math.max(0, 3 - Math.floor(this.countdownT / BEAT))
    if (this.countdownT >= BEAT * 3) {
      this.go()
      return
    }
    if (beat !== this.lastBeat) {
      this.lastBeat = beat
      audio.unlock()
      this.o.callbacks.onCountdown(beat)
      sfx.countdown(beat)
    }
  }

  private updateContacts(): void {
    const spec = this.o.spec
    this.carModel.wheelNodes.forEach((node, i) => {
      const c = this.contacts[i]
      if (!c)
        return
      node.getWorldPosition(this.tmpV)
      c.x = this.tmpV.x
      c.y = this.tmpV.y - spec.wheels[i]!.radius
      c.z = this.tmpV.z
    })
  }

  private hudTick(now: number, dt: number, view: VehicleState): void {
    this.hudClock += dt
    if (this.hudClock < HUD_INTERVAL)
      return
    this.hudClock = 0
    if (this.toast && now > this.toastUntil)
      this.toast = null
    const sliding = this.session.sim.state.wheels.some(w => w.sliding || w.spinning)
    engineSound.update(this.session.sim.state.speed, this.lastRaw.throttle, sliding)
    writeHud({
      view: this.o.hud,
      state: this.session.sim.state,
      run: this.session.run,
      elapsed: this.session.elapsed,
      toast: this.toast,
      throttleOn: this.lastRaw.throttle > 0.05,
    })
    void view
    const suggest = this.session.run?.resetSuggested ?? false
    if (suggest !== this.resetPrompt) {
      this.resetPrompt = suggest
      this.o.callbacks.onResetPrompt(suggest)
    }
  }

  /** Reduce nonessential effects first if frames are slow, then lower render quality. */
  private monitor(dt: number): void {
    if (this.phase === 'paused')
      return
    this.frameEma += (dt - this.frameEma) * 0.05
    if (this.frameEma > 0.028)
      this.slowFrames += 1
    else
      this.slowFrames = Math.max(0, this.slowFrames - 2)
    if (this.slowFrames > 120 && this.effects.enabled) {
      this.effects.enabled = false
      this.slowFrames = 0
    }
    else if (this.slowFrames > 240 && this.kit.quality === 'high') {
      this.kit.setQuality('low')
      this.slowFrames = 0
    }
  }

  /** Snapshot for diagnostics and tests. */
  telemetry(): { phase: DrivePhase, speed: number, elapsed: number, runPhase: string, resets: number, camera: CameraChoice, quality: string, car: number[], cam: number[], frameMs: number } {
    return {
      phase: this.phase,
      speed: this.session.sim.state.speed,
      elapsed: this.session.elapsed,
      runPhase: this.session.phase,
      resets: this.session.run?.run.resets ?? 0,
      camera: this.camera.mode,
      quality: this.kit.quality,
      car: [...this.session.sim.state.pos],
      cam: [this.kit.camera.position.x, this.kit.camera.position.y, this.kit.camera.position.z],
      frameMs: this.frameTimes.length ? this.frameTimes.slice(-60).reduce((a, b) => a + b, 0) / Math.min(60, this.frameTimes.length) : 0,
    }
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    engineSound.stop()
    music.stop()
    this.releaseInput()
    this.session.dispose()
    this.pw.dispose()
    this.carModel.dispose()
    this.envMesh.dispose()
    this.effects.pool.dispose()
    this.kit.dispose()
    this.canvas.remove()
  }
}
