import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { setForward } from '@/game/build/edit'
import { buildStarter } from '@/game/catalog/starters'
import { assessDrive } from '@/game/vehicle/analysis'
import { flatEnv, makeSim, run } from './sim-helpers'

describe('forward axle', () => {
  it('racer with forward flipped to x+ (axles along forward)', async () => {
    const c = sequentialContext('s')
    const base = buildStarter('racer', c)
    const r = setForward(base, 'x+', c)
    if (!r.ok) throw new Error('x')
    const a = assessDrive(r.doc)
    console.log('blocks', a.blocks.map(b => b.code), 'warn', a.warnings.map(b => b.code), a.spec!.wheels.map(w => w.axle.join(',')))
    const { sim } = await makeSim(r.doc, flatEnv(), { assist: 'off' })
    run(sim, 2, { steer: 0, throttle: 1, brake: 0, reverse: false })
    const s = sim.state
    console.log('fwdSpeed', s.forwardSpeed, 'lat', s.lateralSpeed, 'speed', s.speed, 'finite', Number.isFinite(s.speed))
    expect(a.warnings.length).toBeGreaterThan(0)
  })
})
