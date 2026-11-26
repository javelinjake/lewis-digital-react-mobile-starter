import type { ClubState } from '../src'
import { describe, expect, it } from 'vitest'
import { bestIn, cabinetMax, DEFAULT_CONFIG, masteryKey, medalIn, medalLevel, medalTargets, newClubState, parseConfig, recordMastery, upgradeState } from '../src'

const config = DEFAULT_CONFIG
const T0 = Date.UTC(2026, 10, 12, 12)
const fresh = (): ClubState => newClubState(T0, config)

describe('medal targets', () => {
  it('are shares of the game\'s top score, rising from bronze to gold', () => {
    const [bronze, silver, gold] = medalTargets('kick', config)
    expect(bronze).toBe(Math.ceil(0.4 * cabinetMax('kick', config)))
    expect(bronze).toBeLessThan(silver)
    expect(silver).toBeLessThan(gold)
    expect(gold).toBeLessThanOrEqual(cabinetMax('kick', config))
    expect(medalLevel(gold, [bronze, silver, gold])).toBe(3)
    expect(medalLevel(bronze - 1, [bronze, silver, gold])).toBe(0)
  })

  it('refuses shares that do not rise', () => {
    expect(() => parseConfig({ ...config, mastery: { ...config.mastery, shares: { ...config.mastery.shares, kick: [0.8, 0.5, 0.9] } } })).toThrow('rise')
  })
})

describe('earning medals', () => {
  it('pays each medal once, the first time it is reached, and keeps it', () => {
    const [, silver, gold] = medalTargets('pens', config)
    const first = recordMastery(fresh(), 'pens', 1, silver, config)
    expect(first.medals).toEqual(['bronze', 'silver'])
    expect(first.state.coins).toBe(500)
    expect(first.state.tokens).toBe(80)
    expect(medalIn(first.state, 'pens', 1)).toBe(2)

    const again = recordMastery(first.state, 'pens', 1, silver, config)
    expect(again.medals).toEqual([])
    expect(again.state.coins).toBe(first.state.coins)

    const worse = recordMastery(again.state, 'pens', 1, 0, config)
    expect(medalIn(worse.state, 'pens', 1)).toBe(2)

    const top = recordMastery(worse.state, 'pens', 1, gold, config)
    expect(top.medals).toEqual(['gold'])
    expect(top.state.idle.gems).toBe(15)
    expect(top.ledger).toEqual([{ currency: 'gems', amount: 15, reason: 'medal', ref: 'pens:1:gold' }])
  })

  it('keeps medals and bests per league', () => {
    const [, , gold] = medalTargets('keeper', config)
    const fifth = recordMastery(fresh(), 'keeper', 1, gold, config).state
    const fourth = recordMastery(fifth, 'keeper', 2, 3, config)
    expect(fourth.previousBest).toBe(0)
    expect(fourth.newBest).toBe(true)
    expect(bestIn(fourth.state, 'keeper', 1)).toBe(gold)
    expect(bestIn(fourth.state, 'keeper', 2)).toBe(3)
    expect(fourth.state.arcade.medals[masteryKey('keeper', 1)]).toBe(3)
    expect(fourth.state.arcade.best.keeper).toBe(gold)
  })

  it('gives no medal for a play bought with gems, but keeps its best', () => {
    const [, , gold] = medalTargets('kick', config)
    const paid = recordMastery(fresh(), 'kick', 1, gold, config, false)
    expect(paid.medals).toEqual([])
    expect(paid.state.tokens).toBe(0)
    expect(bestIn(paid.state, 'kick', 1)).toBe(gold)
    expect(recordMastery(paid.state, 'kick', 1, gold, config).medals).toEqual(['bronze', 'silver', 'gold'])
  })

  it('starts empty for a club saved before medals existed', () => {
    const { arcade, ...rest } = fresh()
    const old = { ...rest, arcade: { best: arcade.best } } as unknown as ClubState
    expect(upgradeState(old, config).arcade).toMatchObject({ bests: {}, medals: {} })
  })
})
