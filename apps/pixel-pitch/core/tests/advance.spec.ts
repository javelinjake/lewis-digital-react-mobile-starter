import { createRng } from '@ld/utils/random/rng'
import { describe, expect, it } from 'vitest'
import { advance, DEFAULT_CONFIG, type GameConfig, type IdleState, newIdleState, notificationTimes, parseConfig, pendingStadiumCoins, pendingTrayTokens } from '../src'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const T0 = Date.UTC(2026, 10, 8, 12, 0, 0)

const config = DEFAULT_CONFIG
const start = (overrides: Partial<IdleState> = {}): IdleState => ({ ...newIdleState(T0), gemsGrantedForDay: Math.floor(T0 / (24 * HOUR)), ...overrides })

describe('shelf', () => {
  it('earns one pack every 45 minutes and keeps the leftover part of an interval', () => {
    const { state, events } = advance(start(), config, T0 + 100 * MINUTE)
    expect(state.shelfPacks).toBe(2)
    expect(state.shelfClockAt).toBe(T0 + 90 * MINUTE)
    expect(events).toContainEqual({ type: 'packs', gained: 2 })
    expect(advance(state, config, T0 + 135 * MINUTE).state.shelfPacks).toBe(3)
  })

  it('earns nothing before the first interval', () => {
    const { state, events } = advance(start(), config, T0 + 44 * MINUTE)
    expect(state.shelfPacks).toBe(0)
    expect(events).toEqual([])
  })

  it('stops at the capacity of 10, and 16 with the Pass', () => {
    expect(advance(start(), config, T0 + 30 * HOUR).state.shelfPacks).toBe(10)
    expect(advance(start({ hasPass: true }), config, T0 + 30 * HOUR).state.shelfPacks).toBe(16)
  })

  it('idles the clock while full, and starts it again from the moment a pack is taken', () => {
    const full = advance(start(), config, T0 + 30 * HOUR)
    // The player opens a pack at +40h. The server catches up first, then takes it.
    const opened = advance(full.state, config, T0 + 40 * HOUR).state
    const taken = { ...opened, shelfPacks: opened.shelfPacks - 1 }
    expect(taken.shelfClockAt).toBe(T0 + 40 * HOUR)
    expect(advance(taken, config, T0 + 40 * HOUR + 44 * MINUTE).state.shelfPacks).toBe(9)
    expect(advance(taken, config, T0 + 40 * HOUR + 45 * MINUTE).state.shelfPacks).toBe(10)
  })

  it('never loses packs if the clock goes backwards', () => {
    const later = advance(start(), config, T0 + 3 * HOUR).state
    expect(advance(later, config, T0).state.shelfPacks).toBe(later.shelfPacks)
  })

  it('catching up in any number of steps gives the same shelf as catching up once', () => {
    const rng = createRng('shelf-invariance')
    for (let run = 0; run < 500; run++) {
      const capacity = rng.pick([config.shelf.capacity, config.shelf.capacityWithPass])
      const initial = start({
        hasPass: capacity === config.shelf.capacityWithPass,
        shelfPacks: rng.int(0, capacity),
        shelfClockAt: T0 - rng.int(0, 100 * MINUTE),
      })
      const end = T0 + rng.int(0, 60 * HOUR)

      const steps = rng.int(1, 6)
      const times = Array.from({ length: steps }, () => T0 + rng.int(0, end - T0)).sort((a, b) => a - b)
      let stepped = initial
      for (const time of times)
        stepped = advance(stepped, config, time).state
      stepped = advance(stepped, config, end).state

      const once = advance(initial, config, end).state
      expect({ packs: stepped.shelfPacks, clock: stepped.shelfClockAt }).toEqual({ packs: once.shelfPacks, clock: once.shelfClockAt })
    }
  })
})

describe('gems', () => {
  it('grants the day\'s gems once, however often the player looks in that day', () => {
    const fresh = start({ gemsGrantedForDay: -1 })
    const first = advance(fresh, config, T0)
    expect(first.state.gems).toBe(15)
    expect(first.events).toContainEqual({ type: 'gems', amount: 15 })
    const again = advance(first.state, config, T0 + 5 * HOUR)
    expect(again.state.gems).toBe(15)
    expect(again.events.some(event => event.type === 'gems')).toBe(false)
  })

  it('grants again on the next day, and 35 with the Pass', () => {
    const day1 = advance(start({ gemsGrantedForDay: -1 }), config, T0).state
    expect(advance(day1, config, T0 + 24 * HOUR).state.gems).toBe(30)
    expect(advance(start({ gemsGrantedForDay: -1, hasPass: true }), config, T0).state.gems).toBe(35)
  })

  it('gives a player who skips days one day\'s gems, not a back-payment', () => {
    const day1 = advance(start({ gemsGrantedForDay: -1 }), config, T0).state
    expect(advance(day1, config, T0 + 5 * 24 * HOUR).state.gems).toBe(30)
  })

  it('moves the day boundary with the configured offset', () => {
    const late: GameConfig = { ...config, daily: { ...config.daily, dayStartOffsetMinutes: 240 } }
    const before = Date.UTC(2026, 10, 9, 3, 59)
    const after = Date.UTC(2026, 10, 9, 4, 1)
    const first = advance(start({ gemsGrantedForDay: -1 }), late, before).state
    expect(advance(first, late, after).state.gems).toBe(30)
    expect(advance(first, late, Date.UTC(2026, 10, 9, 3, 59, 30)).state.gems).toBe(15)
  })
})

describe('stadium and trays', () => {
  it('fills at the level\'s hourly rate', () => {
    expect(pendingStadiumCoins(start(), config, T0 + 2 * HOUR)).toBe(120)
    expect(pendingStadiumCoins(start({ stadiumLevel: 4 }), config, T0 + 2 * HOUR)).toBe(360)
  })

  it('stops at the 8 hour cap, or 12 with the Pass', () => {
    expect(pendingStadiumCoins(start(), config, T0 + 20 * HOUR)).toBe(60 * 8)
    expect(pendingStadiumCoins(start({ hasPass: true }), config, T0 + 20 * HOUR)).toBe(60 * 12)
  })

  it('does not go negative if the clock is behind', () => {
    expect(pendingStadiumCoins(start(), config, T0 - HOUR)).toBe(0)
  })

  it('fills each cabinet tray on its own timer', () => {
    const state = start({ trayCollectedAt: { kick: T0, keepy: T0 + 2 * HOUR } })
    expect(pendingTrayTokens(state, config, 'kick', T0 + 3 * HOUR)).toBe(36)
    expect(pendingTrayTokens(state, config, 'keepy', T0 + 3 * HOUR)).toBe(12)
  })
})

describe('notificationTimes', () => {
  it('says when the shelf will be full', () => {
    const times = notificationTimes(start({ shelfPacks: 7 }), config, T0)
    expect(times.shelfFullAt).toBe(T0 + 3 * 45 * MINUTE)
  })

  it('says nothing about the shelf when it is already full', () => {
    expect(notificationTimes(start({ shelfPacks: 10 }), config, T0).shelfFullAt).toBeNull()
  })

  it('accounts for packs earned since the state was saved', () => {
    const times = notificationTimes(start({ shelfPacks: 0 }), config, T0 + 90 * MINUTE)
    expect(times.shelfFullAt).toBe(T0 + 10 * 45 * MINUTE)
  })

  it('says when the stadium and the earliest tray will be full', () => {
    const times = notificationTimes(start({ trayCollectedAt: { kick: T0 + HOUR, keepy: T0 } }), config, T0)
    expect(times.stadiumFullAt).toBe(T0 + 8 * HOUR)
    expect(times.traysFullAt).toBe(T0 + 8 * HOUR)
  })
})

describe('config', () => {
  it('ships the spec\'s numbers and keeps paid random items off', () => {
    expect(config.shelf).toMatchObject({ intervalMinutes: 45, capacity: 10, capacityWithPass: 16, playersPerPack: 3, extraPackCoins: 2000, extraPacksPerDay: 3, gemRefillEnabled: false })
    expect(config.league).toMatchObject({ matchIntervalHours: 3, pointsToPromote: 30, lossPoints: 1, lossCoins: 250 })
    expect(config.cabinets).toMatchObject({ freePlaysPerDay: 3, freePlaysPerDayWithPass: 4, arcadePackTokens: 300 })
    expect(config.stadium.coinsPerHour).toHaveLength(10)
  })

  it('accepts its own defaults and rejects an unusable edit from the admin', () => {
    expect(() => parseConfig(config)).not.toThrow()
    expect(() => parseConfig({ ...config, shelf: { ...config.shelf, intervalMinutes: 0 } })).toThrow()
    expect(() => parseConfig({ ...config, stadium: { ...config.stadium, upgradeCost: [1, 2] } })).toThrow('one entry per level')
    expect(() => parseConfig({ version: 1 })).toThrow()
  })
})
