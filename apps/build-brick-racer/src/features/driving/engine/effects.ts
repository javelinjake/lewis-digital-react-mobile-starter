import type { SurfaceId } from '@/game/vehicle/physics-config'
import type { SimEvent, VehicleState } from '@/game/vehicle/sim'
import * as THREE from 'three'

/**
 * Restrained, pooled particles: dust, dirt, mud splashes and sparks. One fixed-size buffer is reused for the
 * whole session (no allocation per frame). Disabled for reduced motion and when frame time is poor.
 */
const SURFACE_COLOUR: Record<SurfaceId, number> = {
  tile: 0xD6D1C7,
  plastic: 0xE8EAEE,
  grass: 0x78994A,
  mud: 0x5A3A1E,
  wood: 0xC9A063,
}

export class ParticlePool {
  readonly points: THREE.Points
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly vel: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private next = 0
  private readonly geometry: THREE.BufferGeometry
  private readonly material: THREE.PointsMaterial
  private readonly base: Float32Array

  constructor(readonly capacity = 240) {
    this.pos = new Float32Array(capacity * 3).fill(0)
    this.base = new Float32Array(capacity * 3)
    this.col = new Float32Array(capacity * 3)
    this.vel = new Float32Array(capacity * 3)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity).fill(1)
    for (let i = 0; i < capacity; i++) this.pos[i * 3 + 1] = -1000
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    this.material = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.name = 'particles'
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, colour: number): void {
    const i = this.next
    this.next = (this.next + 1) % this.capacity
    const o = i * 3
    this.pos[o] = x
    this.pos[o + 1] = y
    this.pos[o + 2] = z
    this.vel[o] = vx
    this.vel[o + 1] = vy
    this.vel[o + 2] = vz
    this.life[i] = life
    this.maxLife[i] = life
    this.col[o] = ((colour >> 16) & 255) / 255
    this.col[o + 1] = ((colour >> 8) & 255) / 255
    this.col[o + 2] = (colour & 255) / 255
    this.base[o] = this.col[o]!
    this.base[o + 1] = this.col[o + 1]!
    this.base[o + 2] = this.col[o + 2]!
  }

  update(dt: number): void {
    let any = false
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i]! <= 0)
        continue
      any = true
      const o = i * 3
      this.life[i] = this.life[i]! - dt
      if (this.life[i]! <= 0) {
        this.pos[o + 1] = -1000
        continue
      }
      this.vel[o + 1] = this.vel[o + 1]! - 4 * dt
      this.pos[o] = this.pos[o]! + this.vel[o]! * dt
      this.pos[o + 1] = this.pos[o + 1]! + this.vel[o + 1]! * dt
      this.pos[o + 2] = this.pos[o + 2]! + this.vel[o + 2]! * dt
      // Fade by darkening toward the ground colour so particles do not pop out.
      const k = Math.min(1, this.life[i]! / this.maxLife[i]! * 1.6)
      this.col[o] = this.base[o]! * k
      this.col[o + 1] = this.base[o + 1]! * k
      this.col[o + 2] = this.base[o + 2]! * k
    }
    if (any) {
      this.geometry.attributes.position!.needsUpdate = true
      this.geometry.attributes.color!.needsUpdate = true
    }
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

export interface WheelWorld {
  /** World position of the tyre contact point for each wheel. */
  contacts: ReadonlyArray<{ x: number, y: number, z: number }>
}

/** Turns wheel state and collision events into particles. */
export class EffectsDirector {
  enabled = true
  private carry = 0

  constructor(readonly pool: ParticlePool) {}

  update(dt: number, state: VehicleState, wheelWorld: WheelWorld, events: readonly SimEvent[]): void {
    if (!this.enabled) {
      this.pool.update(dt)
      return
    }
    this.carry += dt
    const interval = 1 / 28
    while (this.carry >= interval) {
      this.carry -= interval
      state.wheels.forEach((w, i) => {
        const c = wheelWorld.contacts[i]
        if (!c || !w.contact || !w.surface || state.speed < 0.7)
          return
        const kicked = w.sliding || w.spinning
        const mud = w.surface === 'mud'
        if (!kicked && !(mud && state.speed > 1.2))
          return
        const colour = SURFACE_COLOUR[w.surface]
        const n = mud ? 2 : 1
        for (let k = 0; k < n; k++) {
          this.pool.emit(
            c.x + (Math.random() - 0.5) * 0.05,
            c.y + 0.02,
            c.z + (Math.random() - 0.5) * 0.05,
            -state.vel[0] * 0.25 + (Math.random() - 0.5) * 0.7,
            0.5 + Math.random() * (mud ? 1.6 : 0.9),
            -state.vel[2] * 0.25 + (Math.random() - 0.5) * 0.7,
            0.35 + Math.random() * 0.35,
            colour,
          )
        }
      })
    }
    for (const e of events) {
      if (e.type === 'impact' || e.type === 'wall') {
        const strength = e.type === 'impact' ? Math.min(1, e.magnitude / 4) : 0.5
        for (let k = 0; k < 6 + strength * 8; k++) {
          this.pool.emit(
            state.pos[0] + (Math.random() - 0.5) * 0.3,
            state.pos[1] + 0.1,
            state.pos[2] + (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 3,
            0.6 + Math.random() * 1.8,
            (Math.random() - 0.5) * 3,
            0.25 + Math.random() * 0.25,
            k % 2 ? 0xFFC83D : 0xFF7A1A,
          )
        }
      }
    }
    this.pool.update(dt)
  }
}
