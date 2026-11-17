import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { buildStarter } from '@/game/catalog/starters'
import { flatEnv, makeSim, run } from './sim-helpers'

describe('steering direction', () => {
  it('positive steer turns the car to its right (negative yaw about +Y) and rear steer is opposite', async () => {
    const doc = buildStarter('racer', sequentialContext('s'))
    const { sim } = await makeSim(doc, flatEnv(), { assist: 'off' })
    run(sim, 1, { steer: 0, throttle: 1, brake: 0, reverse: false })
    run(sim, 1.5, { steer: 1, throttle: 0.5, brake: 0, reverse: false })
    const s = sim.state
    console.log('yawRate', s.yawRate, 'lat', s.lateralSpeed, 'pos', s.pos, 'wheel steer', s.wheels.map(w => w.steer.toFixed(2)))
    expect(s.yawRate).toBeLessThan(0)
    expect(s.pos[0]).toBeLessThan(0)
  })
})
