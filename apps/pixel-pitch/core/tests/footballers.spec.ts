import { describe, expect, it } from 'vitest'
import { albumSets, DEFAULT_CONFIG, FOOTBALLERS, packPool, RARITIES, rollPack, rollStarterSquad } from '../src'

const config = DEFAULT_CONFIG

describe('the footballers', () => {
  it('are a fixed set of 200 with unique, stable ids and names', () => {
    expect(FOOTBALLERS).toHaveLength(200)
    expect(new Set(FOOTBALLERS.map(player => player.id)).size).toBe(200)
    expect(new Set(FOOTBALLERS.map(player => player.name)).size).toBe(200)
    expect(FOOTBALLERS[0]).toMatchObject({ id: 'p001', name: 'Gaspar Marisol' })
  })

  it('put 180 in packs, split 60, 50, 40, 22 and 8 by rarity', () => {
    const pool = packPool(FOOTBALLERS, config)
    expect(pool).toHaveLength(180)
    expect(RARITIES.map(rarity => pool.filter(player => player.rarity === rarity).length)).toEqual([60, 50, 40, 22, 8])
  })

  it('never roll a retired player, in a pack or a starter squad, and leave them out of the album', () => {
    const retired = new Set(config.cards.retired)
    for (let pack = 0; pack < 400; pack++) {
      const roll = rollPack({ catalogue: FOOTBALLERS, tier: 5, pity: 0, seed: `pack-${pack}`, config })
      expect(roll.players.some(player => retired.has(player.id))).toBe(false)
    }
    for (let club = 0; club < 100; club++)
      expect(rollStarterSquad({ catalogue: FOOTBALLERS, seed: `starter:${club}`, config }).some(player => retired.has(player.id))).toBe(false)
    const sets = albumSets(FOOTBALLERS, config)
    expect(sets.flatMap(set => set.playerIds).some(id => retired.has(id))).toBe(false)
    expect(sets).toHaveLength(30)
    expect(new Set(sets.flatMap(set => set.playerIds)).size).toBe(180)
  })
})
