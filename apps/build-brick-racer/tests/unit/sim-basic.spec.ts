import { describe, expect, it } from 'vitest'
import { sequentialContext } from '@/game/build/doc'
import { buildStarter } from '@/game/catalog/starters'
import { flatEnv, GAS, IDLE, makeSim, run } from './sim-helpers'

describe('vehicle sim smoke', () => {
  it('settles on the ground without exploding', async () => {
    const doc = buildStarter('racer', sequentialContext('s'))
    const { sim, spec } = await makeSim(doc, flatEnv())
    run(sim, 3, IDLE)
    const s = sim.state
    expect(Number.isFinite(s.pos[1])).toBe(true)
    expect(s.speed).toBeLessThan(0.05)
    expect(s.groundedWheels).toBe(4)
    expect(s.upDot).toBeGreaterThan(0.99)
    // Ride height: wheel bottoms near the ground plane (within suspension sag).
    expect(Math.abs(s.pos[1] + spec.wheelBottomY)).toBeLessThan(0.04)
  })

  it('accelerates under power and tops out', async () => {
    const doc = buildStarter('racer', sequentialContext('s'))
    const { sim } = await makeSim(doc, flatEnv())
    run(sim, 1, GAS)
    const v1 = sim.state.forwardSpeed
    run(sim, 6, GAS)
    const v2 = sim.state.forwardSpeed
    expect(v1).toBeGreaterThan(1)
    expect(v2).toBeGreaterThan(v1)
    expect(sim.state.forwardSpeed).toBeGreaterThan(0)
  })
})
