/**
 * DEVELOPMENT TEST HARNESS ONLY. Scripted input traces used to calibrate challenge thresholds and to
 * check rules. Nothing here ships in the player experience: driving input in the app comes only
 * from the player's controls.
 */
import type { CarDocument } from '@/game/build/types'
import type { ChallengeId } from '@/game/challenges/types'
import type { RawControls } from '@/game/vehicle/input'
import { catalog } from '@/game/catalog/catalog'
import { ENVIRONMENTS, getChallenge } from '@/game/challenges'
import { evaluateRun } from '@/game/challenges/eval'
import { qRotate } from '@/game/math'
import { DriveSession } from '@/game/session'
import { compileVehicle } from '@/game/vehicle/compile'
import { emptyControls } from '@/game/vehicle/input'
import { loadRapier } from '@/game/vehicle/rapier'
import { PhysicsWorld } from '@/game/vehicle/world'

export type Driver = (s: DriveSession, t: number) => Partial<RawControls>

function steerTo(s: DriveSession, x: number, z: number, gain = 1.6): number {
  const st = s.sim.state
  const left = qRotate(st.quat, [1, 0, 0])
  const fwd = qRotate(st.quat, [0, 0, 1])
  const dx = x - st.pos[0]
  const dz = z - st.pos[2]
  const len = Math.hypot(dx, dz) || 1
  const lateral = (dx * left[0] + dz * left[2]) / len
  const ahead = (dx * fwd[0] + dz * fwd[2]) / len
  // Positive steer is a right turn.
  return Math.max(-1, Math.min(1, -(ahead < 0 ? Math.sign(lateral) || 1 : lateral * gain)))
}

function holdSpeed(s: DriveSession, target: number): { throttleAxis: number, brakeAxis: number } {
  const v = s.sim.state.forwardSpeed
  const err = target - v
  return { throttleAxis: Math.max(0, Math.min(1, err * 2.5)), brakeAxis: err < -0.4 ? Math.min(1, -err) : 0 }
}

/** Aim at the next gate centre, or a fixed lookahead along x when no gates remain. */
function gateDriver(throttle: boolean): Driver {
  return (s) => {
    const run = s.run!
    const gates = run.def.gates
    const next = gates[Math.min(run.run.gateIndex, gates.length - 1)]
    const target = next ? [next.centre[0], next.centre[2]] as const : [s.sim.state.pos[0], s.sim.state.pos[2] + 10] as const
    return { steerAxis: steerTo(s, target[0], target[1]), throttleAxis: throttle ? 1 : 0, throttle }
  }
}

export const DRIVERS: Record<ChallengeId, Driver> = {
  kitchen_sprint: gateDriver(false),
  garden_mud: gateDriver(true),
  garden_climb: gateDriver(true),
  kitchen_acceleration: () => ({ throttleAxis: 1, throttle: true }),
  garden_jump: (s) => {
    const x = s.run!.def.start.position[0]
    return { steerAxis: steerTo(s, x, s.sim.state.pos[2] + 8), throttleAxis: 1, throttle: true }
  },
  kitchen_braking: (s) => {
    const r = s.run!.def.rule
    const target = r.kind === 'brake_test' ? r.targetEntrySpeed : 3
    const entered = Boolean(s.run!.run.hud.entered)
    const x = s.run!.def.start.position[0]
    const steer = steerTo(s, x, s.sim.state.pos[2] + 8)
    if (entered || s.sim.state.pos[2] > 16.2)
      return { steerAxis: steer, brakeAxis: 1, brake: true, throttleAxis: 0 }
    return { steerAxis: steer, ...holdSpeed(s, target) }
  },
  kitchen_coast: (s) => {
    const r = s.run!.def.rule
    const target = r.kind === 'coast' ? r.targetEntrySpeed : 3
    const x = s.run!.def.start.position[0]
    return { steerAxis: steerTo(s, x, s.sim.state.pos[2] + 8), ...(s.run!.run.hud.entered ? {} : holdSpeed(s, target)) }
  },
  kitchen_drift: (s) => {
    const st = s.sim.state
    const rule = s.run!.def.rule
    if (rule.kind !== 'drift')
      return {}
    const [cx, cz] = rule.zone.centre
    const mid = (rule.zone.inner + rule.zone.outer) / 2
    if (st.pos[2] < cz - 1.5)
      return { steerAxis: steerTo(s, 0, st.pos[2] + 8), throttleAxis: 1, throttle: true }
    const angle = Math.atan2(st.pos[2] - cz, st.pos[0] - cx)
    if (angle > 1.25) {
      const exit = s.run!.def.gates.find(g => g.kind === 'finish')!
      return { steerAxis: steerTo(s, exit.centre[0], exit.centre[2]), throttleAxis: 1, throttle: true }
    }
    // Kick the car into a slide on entry, then counter-steer along the corner tangent.
    if (angle < 0.3)
      return { steerAxis: 0.9, throttleAxis: 1, throttle: true }
    const r = Math.hypot(st.pos[0] - cx, st.pos[2] - cz)
    const tangent = [-Math.sin(angle), Math.cos(angle)]
    const inward = [(cx - st.pos[0]) / (r || 1), (cz - st.pos[2]) / (r || 1)]
    const pull = Math.max(-0.6, Math.min(0.6, (r - mid) * 0.12))
    const want = Math.atan2(tangent[0]! + inward[0]! * pull, tangent[1]! + inward[1]! * pull)
    const fwd = qRotate(st.quat, [0, 0, 1])
    const have = Math.atan2(fwd[0], fwd[2])
    let err = want - have
    while (err > Math.PI) err -= 2 * Math.PI
    while (err < -Math.PI) err += 2 * Math.PI
    return { steerAxis: Math.max(-1, Math.min(1, -err * 1.1)), throttleAxis: 1, throttle: true }
  },
}

export interface TrialResult {
  outcome: ReturnType<typeof evaluateRun>
  seconds: number
  endState: { pos: number[], speed: number }
  session: DriveSession
}

export async function runChallenge(doc: CarDocument, id: ChallengeId, driver: Driver = DRIVERS[id], opts: { assist?: 'off' | 'light', maxSeconds?: number } = {}): Promise<TrialResult> {
  const def = getChallenge(id)!
  const R = await loadRapier()
  const pw = new PhysicsWorld(R, ENVIRONMENTS[def.environment])
  const compiled = compileVehicle(doc, catalog)
  if (!compiled.ok)
    throw new Error(JSON.stringify(compiled.issues))
  const session = new DriveSession({ pw, spec: compiled.spec, challenge: def, assist: opts.assist ?? 'light' })
  session.settle()
  session.start()
  const max = Math.round((opts.maxSeconds ?? def.timeLimit + 2) * 60)
  for (let i = 0; i < max && session.run!.run.phase === 'running'; i++) {
    const raw = { ...emptyControls(), ...driver(session, session.elapsed) }
    session.step(raw)
  }
  const st = session.sim.state
  return { outcome: evaluateRun(def, session.run!.run), seconds: session.elapsed, endState: { pos: [...st.pos], speed: st.speed }, session }
}
