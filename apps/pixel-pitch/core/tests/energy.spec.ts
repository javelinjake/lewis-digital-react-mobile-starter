import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, energyAt, energyMax, newClubState, nextEnergyAt, spendEnergy } from '../src'

const config = DEFAULT_CONFIG
const MINUTE = 60_000
const T0 = Date.UTC(2026, 10, 9, 12)
const fresh = () => newClubState(T0, config)

describe('energy', () => {
  it('starts full: five, or six with the Pass', () => {
    expect(energyAt(fresh(), config, T0)).toBe(5)
    const pass = { ...fresh(), idle: { ...fresh().idle, hasPass: true } }
    expect(energyMax(pass, config)).toBe(6)
    expect(energyAt(pass, config, T0)).toBe(6)
  })

  it('goes down one a play and refuses at zero', () => {
    let state = fresh()
    for (let play = 0; play < 5; play++)
      state = spendEnergy(state, config, T0)
    expect(energyAt(state, config, T0)).toBe(0)
    expect(() => spendEnergy(state, config, T0)).toThrow(/Out of energy/)
  })

  it('comes back one every 90 minutes and never goes above the maximum', () => {
    let state = fresh()
    for (let play = 0; play < 5; play++)
      state = spendEnergy(state, config, T0)
    const at = (minutes: number) => energyAt(state, config, T0 + minutes * MINUTE)
    expect([0, 89, 90, 179, 180, 269, 270, 449, 450, 451, 10_000].map(at)).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 5, 5, 5])
  })

  it('is the same however the plays are spread out: the time it is full again only grows by 90 minutes a play', () => {
    let spread = fresh()
    spread = spendEnergy(spread, config, T0)
    spread = spendEnergy(spread, config, T0 + 40 * MINUTE)
    spread = spendEnergy(spread, config, T0 + 200 * MINUTE)
    // The first play's 90 minutes are over before the third, so the bar was refilling in the meantime.
    expect(spread.energy.fullAt).toBe(T0 + 200 * MINUTE + 90 * MINUTE + Math.max(0, T0 + 180 * MINUTE - (T0 + 200 * MINUTE)))
    let burst = fresh()
    for (let play = 0; play < 3; play++)
      burst = spendEnergy(burst, config, T0)
    expect(burst.energy.fullAt).toBe(T0 + 270 * MINUTE)
    expect(energyAt(burst, config, T0)).toBe(2)
  })

  it('says when the next point arrives, and nothing when the bar is full', () => {
    expect(nextEnergyAt(fresh(), config, T0)).toBeNull()
    let state = fresh()
    for (let play = 0; play < 5; play++)
      state = spendEnergy(state, config, T0)
    expect(nextEnergyAt(state, config, T0)).toBe(T0 + 90 * MINUTE)
    expect(nextEnergyAt(state, config, T0 + 100 * MINUTE)).toBe(T0 + 180 * MINUTE)
    expect(nextEnergyAt(state, config, T0 + 449 * MINUTE)).toBe(T0 + 450 * MINUTE)
    expect(nextEnergyAt(state, config, T0 + 450 * MINUTE)).toBeNull()
  })

  it('rises at once when the Pass is gained, and does not carry on above the lower maximum when it ends', () => {
    let state = fresh()
    state = spendEnergy(state, config, T0)
    state = spendEnergy(state, config, T0)
    expect(energyAt(state, config, T0)).toBe(3)
    const pass = { ...state, idle: { ...state.idle, hasPass: true } }
    expect(energyAt(pass, config, T0)).toBe(4)
    expect(energyAt({ ...pass, idle: { ...pass.idle, hasPass: false } }, config, T0)).toBe(3)
    expect(energyAt({ ...fresh(), idle: { ...fresh().idle, hasPass: true } }, config, T0 + MINUTE)).toBe(6)
    // With the Pass over, a six-point bar read at the lower ceiling is just full.
    expect(energyAt({ ...fresh(), energy: { fullAt: 0 } }, config, T0)).toBe(5)
  })
})
