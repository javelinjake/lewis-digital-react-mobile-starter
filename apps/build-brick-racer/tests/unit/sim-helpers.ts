import type { CarDocument } from '@/game/build/types'
import type { EnvironmentDefinition, StaticBox } from '@/game/env/types'
import type { DriveInput } from '@/game/vehicle/input'
import type { SurfaceId } from '@/game/vehicle/physics-config'
import { catalog } from '@/game/catalog/catalog'
import { qFromEuler } from '@/game/math'
import { compileVehicle } from '@/game/vehicle/compile'
import { loadRapier } from '@/game/vehicle/rapier'
import { VehicleSim } from '@/game/vehicle/sim'
import { PhysicsWorld } from '@/game/vehicle/world'

export function flatEnv(extra: StaticBox[] = [], surface: SurfaceId = 'tile'): EnvironmentDefinition {
  return {
    id: 'kitchen',
    version: 0,
    label: 'test',
    boxes: [{ id: 'floor', centre: [0, -0.5, 0], half: [200, 0.5, 200], surface, kind: 'ground' }, ...extra],
    props: [],
    sky: { top: '#000', bottom: '#000' },
    fogColour: '#000',
    fogFar: 100,
    cameraVolumes: [],
    replayShots: [],
    killY: -50,
  }
}

export function slab(id: string, centre: [number, number, number], half: [number, number, number], surface: SurfaceId, pitch = 0, yaw = 0): StaticBox {
  return { id, centre, half, surface, kind: 'ground', rot: qFromEuler(pitch, yaw) }
}

export async function makeSim(doc: CarDocument, env: EnvironmentDefinition, opts: { assist?: 'off' | 'light', pos?: [number, number, number], yaw?: number } = {}) {
  const R = await loadRapier()
  const pw = new PhysicsWorld(R, env)
  const compiled = compileVehicle(doc, catalog)
  if (!compiled.ok)
    throw new Error(JSON.stringify(compiled.issues))
  const spec = compiled.spec
  const ground = pw.groundAt(opts.pos?.[0] ?? 0, opts.pos?.[2] ?? 0)!
  const y = ground.y - spec.wheelBottomY + 0.03
  const sim = new VehicleSim(pw, spec, opts.assist ?? 'off', { pos: [opts.pos?.[0] ?? 0, opts.pos?.[1] ?? y, opts.pos?.[2] ?? 0], yaw: opts.yaw ?? 0 })
  return { sim, pw, spec }
}

export function run(sim: VehicleSim, seconds: number, input: DriveInput | ((t: number) => DriveInput), motor = true): void {
  const steps = Math.round(seconds * 60)
  for (let i = 0; i < steps; i++)
    sim.step(typeof input === 'function' ? input(i / 60) : input, motor)
}

export const IDLE: DriveInput = { steer: 0, throttle: 0, brake: 0, reverse: false }
export const GAS: DriveInput = { steer: 0, throttle: 1, brake: 0, reverse: false }
