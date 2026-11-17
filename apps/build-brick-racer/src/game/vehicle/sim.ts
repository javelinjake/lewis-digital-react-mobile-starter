/**
 * Vehicle simulation: one compound Rapier rigid body per car with a wheel-contact model at each wheel.
 * Rapier owns rigid-body integration and body collisions. Suspension, tyres, motor, brakes, aero and
 * steering assist are applied here as impulses each substep. Everything engine specific stays in this
 * file and `world.ts`; the editor and saves never see Rapier.
 */
import type RAPIER from '@dimforge/rapier3d-compat'
import type { Q4, V3 } from '../math'
import type { VehicleSpec, WheelSpec } from './compile'
import type { DriveInput } from './input'
import type { AssistMode, SurfaceId } from './physics-config'
import type { PhysicsWorld } from './world'
import { add, clamp, cross, dot, length, normalize, qFromYaw, qRotate, qRotateInv, scale, sub, UP } from '../math'
import { physicsConfig } from './physics-config'
import { motorTorque, rollingCoefficient, rollingResistance, surfaceGrip, tyreForces } from './tyres'

export interface WheelState {
  /** Steering angle in radians, positive = right. */
  steer: number
  /** Accumulated spin about the axle, radians. */
  spin: number
  /** Vertical offset of the wheel relative to its mount along body up, metres (negative = droop). */
  offset: number
  contact: boolean
  load: number
  sliding: boolean
  spinning: boolean
  surface: SurfaceId | null
}

export interface VehicleState {
  pos: V3
  quat: Q4
  vel: V3
  angVel: V3
  speed: number
  forwardSpeed: number
  lateralSpeed: number
  /** Angle between velocity and heading, radians, valid above walking pace. */
  slipAngle: number
  yawRate: number
  /** Cosine between the car's up and world up: 1 upright, -1 upside down. */
  upDot: number
  groundedWheels: number
  airborne: boolean
  wheelspin: boolean
  reversing: boolean
  wheels: WheelState[]
  /** Highest surface-contact surface under the car (centre wheel or first contact). */
  surface: SurfaceId | null
}

export type SimEvent
  = | { type: 'wall' }
    | { type: 'ground' }
    | { type: 'impact', magnitude: number }

export interface Pose {
  pos: V3
  yaw: number
}

interface Contact {
  point: V3
  normal: V3
  compress: number
  hubDistance: number
  surface: SurfaceId
}

interface WheelRuntime {
  steer: number
  spin: number
  omega: number
  offset: number
  contact: boolean
  load: number
  sliding: boolean
  spinning: boolean
  surface: SurfaceId | null
}

const cfg = physicsConfig

export class VehicleSim {
  private readonly body: RAPIER.RigidBody
  private readonly handles = new Set<number>()
  private readonly queue: RAPIER.EventQueue
  private readonly runtime: WheelRuntime[]
  private readonly wheelbase: number
  private readonly inertiaYaw: number
  private events: SimEvent[] = []
  private brakeHold = 0
  private reversing = false
  private lastVel: V3 = [0, 0, 0]
  private _state!: VehicleState

  constructor(
    private readonly pw: PhysicsWorld,
    readonly spec: VehicleSpec,
    private assist: AssistMode,
    pose: Pose,
  ) {
    const R = pw.rapier
    const q = qFromYaw(pose.yaw)
    const inertia = spec.inertia.values.map(v => Math.max(v, 1e-5))
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(pose.pos[0], pose.pos[1], pose.pos[2])
      .setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] })
      .setCcdEnabled(true)
      .setAngularDamping(0.02)
      .setAdditionalMassProperties(
        spec.mass,
        { x: 0, y: 0, z: 0 },
        { x: inertia[0]!, y: inertia[1]!, z: inertia[2]! },
        { x: spec.inertia.rotation[0], y: spec.inertia.rotation[1], z: spec.inertia.rotation[2], w: spec.inertia.rotation[3] },
      )
    this.body = pw.world.createRigidBody(desc)
    for (const box of spec.colliders) {
      const collider = pw.world.createCollider(
        R.ColliderDesc.cuboid(box.half[0], box.half[1], box.half[2])
          .setTranslation(box.centre[0], box.centre[1], box.centre[2])
          .setDensity(0)
          .setFriction(0.35)
          .setRestitution(0.1)
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        this.body,
      )
      this.handles.add(collider.handle)
    }
    this.queue = new R.EventQueue(true)
    this.runtime = spec.wheels.map(() => ({ steer: 0, spin: 0, omega: 0, offset: 0, contact: false, load: 0, sliding: false, spinning: false, surface: null }))
    const zs = spec.wheels.map(w => w.pos[2])
    this.wheelbase = Math.max(0.2, Math.max(...zs) - Math.min(...zs))
    // Inertia about the vertical axis: principal moment whose axis is closest to body up.
    let best = 0
    let bestDot = -1
    const axes: V3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    axes.forEach((a, i) => {
      const d = Math.abs(qRotate(spec.inertia.rotation, a)[1])
      if (d > bestDot) {
        bestDot = d
        best = i
      }
    })
    this.inertiaYaw = inertia[best]!
    this.lastVel = [0, 0, 0]
    this.refresh(0)
  }

  setAssist(mode: AssistMode): void {
    this.assist = mode
  }

  get state(): VehicleState {
    return this._state
  }

  /** Surface events since the last call (wall hits, belly scrapes, impacts). */
  drainEvents(): SimEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  /** Restore a safe pose: velocities, spin and accumulated state cleared. */
  reset(pose: Pose): void {
    const q = qFromYaw(pose.yaw)
    this.body.setTranslation({ x: pose.pos[0], y: pose.pos[1], z: pose.pos[2] }, true)
    this.body.setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] }, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.body.resetForces(true)
    this.body.resetTorques(true)
    for (const r of this.runtime) {
      r.omega = 0
      r.steer = 0
      r.offset = 0
      r.sliding = false
      r.spinning = false
    }
    this.brakeHold = 0
    this.reversing = false
    this.lastVel = [0, 0, 0]
    this.events = []
    this.refresh(0)
  }

  /** Advance one fixed tick. */
  step(input: DriveInput, motorEnabled: boolean, dt = 1 / cfg.tickHz): void {
    const h = dt / cfg.substeps
    this.updateReverse(input, motorEnabled, dt)
    for (let s = 0; s < cfg.substeps; s++) this.substep(input, motorEnabled, h)
    this.refresh(dt)
  }

  dispose(): void {
    this.pw.world.removeRigidBody(this.body)
    this.queue.free()
  }

  private updateReverse(input: DriveInput, motorEnabled: boolean, dt: number): void {
    if (!motorEnabled) {
      this.reversing = false
      this.brakeHold = 0
      return
    }
    const stopped = Math.abs(this._state.forwardSpeed) < cfg.brakes.standstill
    if (input.brake > 0.3 && input.throttle < 0.05 && stopped)
      this.brakeHold += dt
    else if (input.brake < 0.05)
      this.brakeHold = 0
    if (this.brakeHold >= cfg.brakes.reverseDelay)
      this.reversing = true
    if (input.brake < 0.05 && !input.reverse)
      this.reversing = false
    if (input.throttle > 0.05 && !input.reverse && this.reversing && this._state.forwardSpeed > 0.3)
      this.reversing = false
  }

  private probe(w: WheelSpec, pos: V3, Q: Q4, up: V3): Contact | null {
    const R = this.pw.rapier
    const hub = add(pos, qRotate(Q, w.pos))
    const lift = w.radius * 0.5
    const origin = add(hub, scale(up, lift))
    const extension = w.radius * cfg.suspension.travelFrac
    const ray = new R.Ray({ x: origin[0], y: origin[1], z: origin[2] }, { x: -up[0], y: -up[1], z: -up[2] })
    const hit = this.pw.world.castRayAndGetNormal(ray, lift + w.radius + extension, true, undefined, undefined, undefined, this.body)
    if (!hit || hit.timeOfImpact <= 1e-6)
      return null
    const normal: V3 = [hit.normal.x, hit.normal.y, hit.normal.z]
    if (dot(normal, up) < 0.3)
      return null
    const hubDistance = hit.timeOfImpact - lift
    return {
      point: add(origin, scale([-up[0], -up[1], -up[2]], hit.timeOfImpact)),
      normal,
      compress: w.radius + extension - hubDistance,
      hubDistance,
      surface: this.pw.surfaceOf.get(hit.collider.handle) ?? 'tile',
    }
  }

  private substep(input: DriveInput, motorEnabled: boolean, h: number): void {
    const spec = this.spec
    const t = this.body.translation()
    const r = this.body.rotation()
    const lv = this.body.linvel()
    const av = this.body.angvel()
    const pos: V3 = [t.x, t.y, t.z]
    const Q: Q4 = [r.x, r.y, r.z, r.w]
    const vel: V3 = [lv.x, lv.y, lv.z]
    const ang: V3 = [av.x, av.y, av.z]
    const up = qRotate(Q, UP)
    const nWheels = spec.wheels.length
    const staticLoad = (spec.mass * cfg.gravity) / nWheels

    const contacts = spec.wheels.map(w => this.probe(w, pos, Q, up))
    const touching = contacts.filter(c => c !== null).length
    const mEff = spec.mass / Math.max(1, touching)

    const speed = length(vel)
    const forwardSpeed = dot(vel, qRotate(Q, [0, 0, 1]))
    const driven = spec.wheels.map((w, i) => ({ w, i })).filter(x => x.w.driven)
    const wheelSpeed = driven.length > 0
      ? driven.reduce((a, x) => a + Math.abs(this.runtime[x.i]!.omega), 0) / driven.length
      : 0
    const throttle = motorEnabled
      ? (this.reversing && !input.reverse ? input.brake : input.throttle)
      : 0
    const reverse = input.reverse || this.reversing
    const total = motorEnabled && driven.length > 0 ? motorTorque(wheelSpeed, throttle, reverse) : 0
    const brakeInput = this.reversing && motorEnabled && !input.reverse ? 0 : input.brake

    const steerBase = (cfg.steering.maxAngleDeg * Math.PI) / 180
    const reduction = this.assist === 'light' ? 1 / (1 + (speed / cfg.assist.light.speedReference) ** 2) : 1
    const steerAngle = input.steer * steerBase * reduction

    spec.wheels.forEach((w, i) => {
      const rt = this.runtime[i]!
      const c = contacts[i]
      const delta = (w.steering ? steerAngle * w.steerDirection : 0)
      rt.steer = delta
      if (!c) {
        rt.contact = false
        rt.load = 0
        rt.sliding = false
        rt.surface = null
        rt.offset = -w.radius * cfg.suspension.travelFrac
        const torque = w.driven && total !== 0 ? total / Math.max(1, driven.length) : 0
        const inertia = cfg.tyre.spinInertia * w.massKg * w.radius * w.radius
        rt.omega = clamp(rt.omega + (torque / inertia) * h, -cfg.motor.freeSpeed, cfg.motor.freeSpeed)
        if (w.braking && brakeInput > 0.1)
          rt.omega *= 1 - Math.min(1, 6 * h)
        rt.spinning = false
        return
      }

      const extension = w.radius * cfg.suspension.travelFrac
      const stiffness = ((spec.mass * cfg.gravity) / nWheels) / (cfg.suspension.sagFrac * extension)
      const damping = 2 * cfg.suspension.dampingRatio * Math.sqrt(stiffness * (spec.mass / nWheels))
      const arm = sub(c.point, pos)
      const vc = add(vel, cross(ang, arm))
      const vn = dot(vc, c.normal)
      const load = clamp(stiffness * c.compress - damping * vn, 0, cfg.suspension.maxLoadFactor * staticLoad)

      // Wheel heading, steered about the body's up axis (positive steer = right = -X body).
      const rollBody = normalize(cross(w.axle, UP))
      const a = -delta
      const steered: V3 = [rollBody[0] * Math.cos(a) + rollBody[2] * Math.sin(a), 0, -rollBody[0] * Math.sin(a) + rollBody[2] * Math.cos(a)]
      const rollWorld = qRotate(Q, steered)
      const f = normalize(sub(rollWorld, scale(c.normal, dot(rollWorld, c.normal))))
      const lat = normalize(cross(c.normal, f))
      const vLong = dot(vc, f)
      const vLat = dot(vc, lat)

      const { muX, muY } = surfaceGrip(w, c.surface)
      const driveForce = w.driven && total !== 0 ? total / driven.length / w.radius : 0
      const out = tyreForces({
        load,
        vLong,
        vLat,
        muX,
        muY,
        driveForce,
        brakeInput: w.braking ? brakeInput : 0,
        brakeCap: cfg.brakes.torquePerWheel / w.radius,
        mEff,
        stickRate: cfg.tyre.stickRate,
      })
      const fRoll = rollingResistance(load, rollingCoefficient(w, c.surface), vLong)

      const force = add(add(scale(c.normal, load), scale(f, out.fx + fRoll)), scale(lat, out.fy))
      this.body.applyImpulseAtPoint({ x: force[0] * h, y: force[1] * h, z: force[2] * h }, { x: c.point[0], y: c.point[1], z: c.point[2] }, true)

      // Wheel spin: rolls with the ground unless drive demand exceeds grip.
      const rolling = vLong / w.radius
      const demandBeyondGrip = Math.abs(driveForce) > muX * load * 1.02 && Math.abs(driveForce) > 0.5
      const locked = brakeInput > 0.5 && w.braking && out.sliding && Math.abs(vLong) > 0.3
      if (demandBeyondGrip) {
        const target = Math.sign(driveForce) * Math.min(cfg.motor.freeSpeed, Math.abs(rolling) + 14)
        rt.omega += (target - rt.omega) * Math.min(1, 10 * h)
        rt.spinning = true
      }
      else if (locked) {
        rt.omega *= 1 - Math.min(1, 20 * h)
        rt.spinning = false
      }
      else {
        rt.omega += (rolling - rt.omega) * Math.min(1, 30 * h)
        rt.spinning = false
      }
      rt.contact = true
      rt.load = load
      rt.sliding = out.sliding
      rt.surface = c.surface
      rt.offset = clamp(w.radius - c.hubDistance, -extension, w.radius * 0.5)
    })

    this.applyAero(pos, Q, vel, h)
    this.applyAssist(up, ang, forwardSpeed, steerAngle, h)

    this.pw.world.step(this.queue)
    this.queue.drainCollisionEvents((h1, h2, started) => {
      if (!started)
        return
      const mine = this.handles.has(h1) ? h2 : this.handles.has(h2) ? h1 : null
      if (mine === null)
        return
      const kind = this.pw.kindOf.get(mine)
      this.events.push({ type: kind === 'ground' ? 'ground' : 'wall' })
    })

    const nv = this.body.linvel()
    const next: V3 = [nv.x, nv.y, nv.z]
    const dv = length(sub(next, this.lastVel))
    if (dv > 1.4 && touching < nWheels)
      this.events.push({ type: 'impact', magnitude: dv })
    this.lastVel = next
  }

  private applyAero(pos: V3, Q: Q4, vel: V3, h: number): void {
    const speed = length(vel)
    if (speed < 0.05)
      return
    const { aero } = this.spec
    const dirB = qRotateInv(Q, scale(vel, 1 / speed))
    const area = Math.abs(dirB[2]) * aero.front + Math.abs(dirB[0]) * aero.side + Math.abs(dirB[1]) * aero.top
    const q = 0.5 * cfg.aero.density * speed * speed
    const drag = scale(vel, (-q * cfg.aero.bodyDragCoefficient * area * h) / speed)
    this.body.applyImpulse({ x: drag[0], y: drag[1], z: drag[2] }, true)

    const forward = dot(vel, qRotate(Q, [0, 0, 1]))
    for (const wing of aero.wings) {
      const effective = wing.area * (1 - wing.shielded) * wing.alignment
      const at = add(pos, qRotate(Q, wing.pos))
      const down = scale(qRotate(Q, UP), -0.5 * cfg.aero.density * cfg.aero.wingLiftCoefficient * effective * forward * forward * h)
      const wd = scale(vel, (-q * cfg.aero.wingDragCoefficient * effective * h) / speed)
      const j = add(down, wd)
      this.body.applyImpulseAtPoint({ x: j[0], y: j[1], z: j[2] }, { x: at[0], y: at[1], z: at[2] }, true)
    }
  }

  /** Steering help: damp yaw that goes well beyond what the steering angle asks for. Spins and slides still happen. */
  private applyAssist(up: V3, ang: V3, forwardSpeed: number, steerAngle: number, h: number): void {
    if (this.assist !== 'light' || Math.abs(steerAngle) < 0.02 || Math.abs(forwardSpeed) < 0.6)
      return
    const a = cfg.assist.light
    const yawRate = dot(ang, up)
    // Positive steer is right, which is a negative rotation about up.
    const expected = (-forwardSpeed * Math.tan(steerAngle)) / this.wheelbase
    const allowed = Math.abs(expected) * (1 + a.yawTolerance) + 0.4
    if (Math.abs(yawRate) <= allowed)
      return
    const excess = yawRate - Math.sign(yawRate) * allowed
    const impulse = -a.yawDamping * this.inertiaYaw * excess * h
    this.body.applyTorqueImpulse({ x: up[0] * impulse, y: up[1] * impulse, z: up[2] * impulse }, true)
  }

  private refresh(dt: number): void {
    const t = this.body.translation()
    const r = this.body.rotation()
    const lv = this.body.linvel()
    const av = this.body.angvel()
    const Q: Q4 = [r.x, r.y, r.z, r.w]
    const vel: V3 = [lv.x, lv.y, lv.z]
    const heading = qRotate(Q, [0, 0, 1])
    const left = qRotate(Q, [1, 0, 0])
    const speed = length(vel)
    const forwardSpeed = dot(vel, heading)
    const lateralSpeed = dot(vel, left)
    const up = qRotate(Q, UP)
    const grounded = this.runtime.filter(r2 => r2.contact).length

    for (const rt of this.runtime) rt.spin += rt.omega * dt

    this._state = {
      pos: [t.x, t.y, t.z],
      quat: Q,
      vel,
      angVel: [av.x, av.y, av.z],
      speed,
      forwardSpeed,
      lateralSpeed,
      slipAngle: speed > 0.4 ? Math.atan2(Math.abs(lateralSpeed), Math.abs(forwardSpeed)) : 0,
      yawRate: dot([av.x, av.y, av.z], up),
      upDot: up[1],
      groundedWheels: grounded,
      airborne: grounded === 0,
      wheelspin: this.runtime.some(rt => rt.spinning),
      reversing: this.reversing,
      wheels: this.runtime.map(rt => ({
        steer: rt.steer,
        spin: rt.spin,
        offset: rt.offset,
        contact: rt.contact,
        load: rt.load,
        sliding: rt.sliding,
        spinning: rt.spinning,
        surface: rt.surface,
      })),
      surface: this.runtime.find(rt => rt.contact)?.surface ?? null,
    }
  }
}
