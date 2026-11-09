import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, generateCatalogue, isStarOrBetter, oddsForTier, parseConfig, RARITIES, type Rarity, rollPack } from '../src'

const config = DEFAULT_CONFIG
const catalogue = generateCatalogue(config)

/** Open `packs` packs in a row, carrying the guarantee counter from one to the next like the server does. */
function openMany(packs: number, tier: number, cfg = config, startPity = 0, position?: 'GK') {
  const players = []
  let pity = startPity
  for (let index = 0; index < packs; index++) {
    const roll = rollPack({ catalogue, tier, pity, seed: `pack-${tier}-${index}`, config: cfg, position })
    players.push(...roll.players)
    pity = roll.pityAfter
  }
  return players
}

const share = (players: { rarity: Rarity }[]) => RARITIES.map(rarity => players.filter(player => player.rarity === rarity).length / players.length * 100)

describe('odds', () => {
  it('has the spec\'s endpoints: League 5 and League 1', () => {
    expect(oddsForTier(1, config)).toEqual([70, 24, 5, 0.9, 0.1])
    expect(oddsForTier(5, config)).toEqual([25, 35, 28, 10, 2])
  })

  it('improves with every league, and every row adds up to 100', () => {
    for (let tier = 1; tier <= 5; tier++)
      expect(oddsForTier(tier, config).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 6)
    for (let tier = 1; tier < 5; tier++) {
      const now = oddsForTier(tier, config)
      const next = oddsForTier(tier + 1, config)
      expect(next[0]).toBeLessThan(now[0])
      expect(next[3] + next[4]).toBeGreaterThan(now[3] + now[4])
    }
  })

  it('uses League 1\'s odds for Prestige tiers, and League 5\'s for a tier below the table', () => {
    expect(oddsForTier(9, config)).toEqual(oddsForTier(5, config))
    expect(oddsForTier(0, config)).toEqual(oddsForTier(1, config))
  })

  it('rejects odds that do not add up when the config is edited', () => {
    const broken = { ...config, packs: { ...config.packs, oddsByLeague: [[50, 50, 5, 0, 0]] } }
    expect(() => parseConfig(broken)).toThrow('adds up to 105')
  })
})

describe('rolling a pack', () => {
  it('gives three players from the catalogue, and the same three for the same seed', () => {
    const a = rollPack({ catalogue, tier: 1, pity: 0, seed: 'x', config })
    const b = rollPack({ catalogue, tier: 1, pity: 0, seed: 'x', config })
    expect(a.players).toHaveLength(3)
    expect(a.players).toEqual(b.players)
    expect(a.players.every(player => catalogue.includes(player))).toBe(true)
    expect(rollPack({ catalogue, tier: 1, pity: 0, seed: 'y', config }).players).not.toEqual(a.players)
  })

  it('follows the odds when the guarantee is out of the way (60,000 players at League 1 and League 5)', () => {
    const noPity = { ...config, packs: { ...config.packs, pityPlayers: 1_000_000 } }
    for (const tier of [1, 5]) {
      const observed = share(openMany(20_000, tier, noPity))
      oddsForTier(tier, config).forEach((expected, index) => {
        expect(Math.abs(observed[index] - expected), `tier ${tier} ${RARITIES[index]}`).toBeLessThan(1)
      })
    }
  })

  it('fails clearly if the catalogue is missing a rarity', () => {
    const noLegends = catalogue.filter(player => player.rarity !== 'legend')
    expect(() => rollPack({ catalogue: noLegends, tier: 5, pity: 39, seed: 1, config: { ...config, packs: { ...config.packs, oddsByLeague: [[0.001, 0.001, 0.001, 0.001, 99.996]] } } })).toThrow('no legend players')
  })
})

describe('the Star guarantee', () => {
  it('hands out a Star or better when 39 players have gone without one', () => {
    const roll = rollPack({ catalogue, tier: 1, pity: 39, seed: 'due', config })
    expect(roll.guaranteed[0]).toBe(true)
    expect(isStarOrBetter(roll.players[0].rarity)).toBe(true)
  })

  it('does not guarantee anything before then', () => {
    const roll = rollPack({ catalogue, tier: 1, pity: 10, seed: 'early', config })
    expect(roll.guaranteed[0]).toBe(false)
  })

  it('resets after a Star or better, and counts up otherwise', () => {
    const roll = rollPack({ catalogue, tier: 1, pity: 39, seed: 'reset', config })
    const afterStar = roll.players.slice(1).filter(player => !isStarOrBetter(player.rarity)).length
    expect(roll.pityAfter).toBeLessThanOrEqual(afterStar + 0)
  })

  it('never lets more than 39 players pass without a Star or better, over 100,000 players', () => {
    const players = openMany(33_334, 1)
    let drought = 0
    let longest = 0
    for (const player of players) {
      drought = isStarOrBetter(player.rarity) ? 0 : drought + 1
      longest = Math.max(longest, drought)
    }
    expect(longest).toBeLessThanOrEqual(39)
  })

  it('lifts the League 5 Star rate well above the printed 1% (about 3%), which is the spec\'s rule working as written', () => {
    const players = openMany(20_000, 1)
    const rate = players.filter(player => isStarOrBetter(player.rarity)).length / players.length
    expect(rate).toBeGreaterThan(0.025)
    expect(rate).toBeLessThan(0.036)
  })
})

describe('Arcade packs', () => {
  it('make players of the chosen position about twice as likely', () => {
    const noPity = { ...config, packs: { ...config.packs, pityPlayers: 1_000_000 } }
    const gk = (players: { position: string }[]) => players.filter(player => player.position === 'GK').length / players.length
    const plain = gk(openMany(8000, 3, noPity))
    const boosted = gk(openMany(8000, 3, noPity, 0, 'GK'))
    expect(boosted / plain).toBeGreaterThan(1.5)
    expect(boosted / plain).toBeLessThan(2.1)
  })
})
