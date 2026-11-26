import type { ClubState, FlowContext } from '../src'
import { describe, expect, it } from 'vitest'
import { buyKit, DEFAULT_CONFIG, FOOTBALLERS, FREE_KITS, isFreeKit, isGameRuleError, mayWearKit, newClubState } from '../src'

const config = DEFAULT_CONFIG
const T0 = Date.UTC(2026, 10, 12, 12)
const withGems = (gems: number): ClubState => ({ ...newClubState(T0, config), idle: { ...newClubState(T0, config).idle, gems } })
const context = (state: ClubState): FlowContext => ({ state, cards: [], catalogue: FOOTBALLERS, players: () => undefined, config, clubId: 'c', now: T0 })
const code = (run: () => unknown) => {
  try {
    run()
    return 'accepted'
  }
  catch (error) {
    return isGameRuleError(error) ? error.code : 'other'
  }
}

describe('the shop', () => {
  const kit = config.shop.kits[0]

  it('sells premium kits for gems, once, and they can then be worn', () => {
    const bought = buyKit(context(withGems(500)), kit.id)
    expect(bought.state.idle.gems).toBe(500 - kit.gems)
    expect(bought.state.cosmetics).toEqual([kit.id])
    expect(bought.ledger).toEqual([{ currency: 'gems', amount: -kit.gems, reason: 'shop', ref: kit.id }])
    expect(mayWearKit(bought.state, kit.primary, kit.secondary, config)).toBe(true)
    expect(code(() => buyKit(context(bought.state), kit.id))).toBe('owned')
  })

  it('refuses without the gems, and an item that is not in the shop', () => {
    expect(code(() => buyKit(context(withGems(kit.gems - 1)), kit.id))).toBe('gems')
    expect(code(() => buyKit(context(withGems(1000)), 'kit-free-gems'))).toBe('no-item')
  })

  it('lets anyone wear a free kit, and only an owner a premium one', () => {
    const [primary, secondary] = FREE_KITS[2]
    expect(isFreeKit(primary.toUpperCase(), secondary)).toBe(true)
    expect(mayWearKit(newClubState(T0, config), primary, secondary, config)).toBe(true)
    expect(mayWearKit(newClubState(T0, config), kit.primary, kit.secondary, config)).toBe(false)
    expect(mayWearKit(newClubState(T0, config), '#123456', '#654321', config)).toBe(false)
  })

  it('sells looks only: no premium kit is a free one', () => {
    expect(config.shop.kits.some(entry => isFreeKit(entry.primary, entry.secondary))).toBe(false)
    expect(new Set(config.shop.kits.map(entry => entry.id)).size).toBe(config.shop.kits.length)
  })
})
