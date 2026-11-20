import { describe, expect, it } from 'vitest'
import { benchCount, benchHasRoom, cardRating, DEFAULT_CONFIG, generateCatalogue, HAIR_COLOURS, HAIR_STYLES, mergeable, mergeCards, type OwnedCard, type Player, RARITIES, SKIN_TONES, sellValue, toFielded, train, trainingCost } from '../src'

const config = DEFAULT_CONFIG
const catalogue = generateCatalogue(config)
const star = catalogue.find(player => player.rarity === 'star')!
const grassroots = catalogue.find(player => player.rarity === 'grassroots')!

const card = (id: string, player: Player, over: Partial<OwnedCard> = {}): OwnedCard => ({ id, playerId: player.id, stars: 1, trained: 0, ...over })

describe('generateCatalogue', () => {
  it('makes the 200 players the spec asks for, split by rarity', () => {
    expect(catalogue).toHaveLength(200)
    for (const rarity of RARITIES)
      expect(catalogue.filter(player => player.rarity === rarity)).toHaveLength(config.cards.catalogueCounts[rarity])
  })

  it('gives every player a rating inside their rarity\'s band', () => {
    for (const player of catalogue) {
      const [low, high] = config.cards.ratingBands[player.rarity]
      expect(player.rating).toBeGreaterThanOrEqual(low)
      expect(player.rating).toBeLessThanOrEqual(high)
    }
  })

  it('has every position in every rarity, with goalkeepers the rarest', () => {
    for (const rarity of RARITIES) {
      const ofRarity = catalogue.filter(player => player.rarity === rarity)
      for (const position of ['GK', 'DEF', 'MID', 'FWD'])
        expect(ofRarity.some(player => player.position === position), `${rarity} has no ${position}`).toBe(true)
    }
    const count = (position: string) => catalogue.filter(player => player.position === position).length
    expect(count('GK')).toBeLessThan(count('DEF'))
  })

  it('spreads players across the four nations evenly', () => {
    const counts = [0, 1, 2, 3].map(nation => catalogue.filter(player => player.nation === nation).length)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(5)
    expect(counts.every(value => value > 0)).toBe(true)
  })

  it('gives a second position to about half the outfielders, always next door, and never to goalkeepers', () => {
    expect(catalogue.filter(player => player.position === 'GK').every(player => !player.altPosition)).toBe(true)
    const outfield = catalogue.filter(player => player.position !== 'GK')
    const share = outfield.filter(player => player.altPosition).length / outfield.length
    expect(share).toBeGreaterThan(0.35)
    expect(share).toBeLessThan(0.65)
    for (const player of outfield.filter(entry => entry.altPosition)) {
      expect(player.altPosition).not.toBe('GK')
      expect(player.altPosition).not.toBe(player.position)
      if (player.position === 'DEF')
        expect(player.altPosition).toBe('MID')
      if (player.position === 'FWD')
        expect(player.altPosition).toBe('MID')
    }
  })

  it('has unique names and ids, and valid sprite parts', () => {
    expect(new Set(catalogue.map(player => player.name)).size).toBe(200)
    expect(catalogue.map(player => player.id)).toEqual(Array.from({ length: 200 }, (_, index) => `p${String(index + 1).padStart(3, '0')}`))
    for (const { sprite } of catalogue) {
      expect(sprite.skin).toBeLessThan(SKIN_TONES)
      expect(sprite.hairStyle).toBeLessThan(HAIR_STYLES.length)
      expect(sprite.hairColour).toBeLessThan(HAIR_COLOURS.length)
    }
  })

  it('is the same every time for one seed, and different for another', () => {
    expect(generateCatalogue(config)).toEqual(catalogue)
    expect(generateCatalogue(config, 'another seed')).not.toEqual(catalogue)
  })
})

describe('card rating', () => {
  it('is the player\'s rating, +6 per star above the first, +1 per training', () => {
    expect(cardRating(card('a', star), star, config)).toBe(star.rating)
    expect(cardRating(card('a', star, { stars: 3 }), star, config)).toBe(star.rating + 12)
    expect(cardRating(card('a', star, { stars: 2, trained: 2 }), star, config)).toBe(star.rating + 8)
  })

  it('never goes past 99', () => {
    expect(cardRating(card('a', star, { stars: 5, trained: 6 }), star, config)).toBe(99)
  })

  it('carries position and nation into the lineup', () => {
    expect(toFielded(card('a', star), star, config)).toEqual({ position: star.position, altPosition: star.altPosition, nation: star.nation, rating: star.rating })
  })
})

describe('selling', () => {
  it('pays the spec\'s values per rarity', () => {
    const value = (rarity: string) => sellValue(card('a', catalogue.find(player => player.rarity === rarity)!), catalogue.find(player => player.rarity === rarity)!, config)
    expect(RARITIES.map(value)).toEqual([50, 150, 600, 3000, 20_000])
  })

  it('values a merged card at the cards that went into it', () => {
    expect(sellValue(card('a', star, { stars: 2 }), star, config)).toBe(9000)
    expect(sellValue(card('a', star, { stars: 3 }), star, config)).toBe(27_000)
  })
})

describe('training', () => {
  it('costs more each time and stops at the cap for the rarity', () => {
    let current = card('a', grassroots)
    const costs: number[] = []
    for (let step = 0; step < config.cards.trainingCap.grassroots; step++) {
      const result = train(current, grassroots, config)
      costs.push(result.cost)
      current = result.card
    }
    expect(costs).toEqual([100, 200, 300])
    expect(current.trained).toBe(3)
    expect(trainingCost(current, grassroots, config)).toEqual({ blocked: 'maxed' })
    expect(() => train(current, grassroots, config)).toThrow('fully trained')
  })

  it('lets better rarities be trained further', () => {
    expect(config.cards.trainingCap.legend).toBeGreaterThan(config.cards.trainingCap.grassroots)
  })
})

describe('merging', () => {
  const copies = [card('a', star), card('b', star), card('c', star), card('d', star)]

  it('lists groups with enough copies at the same star level', () => {
    expect(mergeable(copies, config)).toHaveLength(1)
    expect(mergeable(copies.slice(0, 2), config)).toEqual([])
    expect(mergeable([...copies.slice(0, 2), card('x', star, { stars: 2 })], config)).toEqual([])
  })

  it('never offers a merge at the top star level', () => {
    expect(mergeable([card('a', star, { stars: 5 }), card('b', star, { stars: 5 }), card('c', star, { stars: 5 })], config)).toEqual([])
  })

  it('turns three copies into one a star higher, keeping the best training, and leaves other cards alone', () => {
    const trained = [card('a', star, { trained: 1 }), card('b', star, { trained: 3 }), card('c', star), card('d', star)]
    const { cards, merged } = mergeCards(trained, ['a', 'b', 'c'], 'new', config)
    expect(merged).toEqual({ id: 'new', playerId: star.id, stars: 2, trained: 3 })
    expect(cards.map(entry => entry.id).sort()).toEqual(['d', 'new'])
    expect(cardRating(merged, star, config)).toBe(star.rating + 6 + 3)
  })

  it('refuses anything but the right number of the same player at the same star level', () => {
    const other = card('z', grassroots)
    expect(() => mergeCards(copies, ['a', 'b'], 'new', config)).toThrow('exactly 3')
    expect(() => mergeCards(copies, ['a', 'a', 'b'], 'new', config)).toThrow('exactly 3')
    expect(() => mergeCards([...copies, other], ['a', 'b', 'z'], 'new', config)).toThrow('same player')
    expect(() => mergeCards([...copies, card('s', star, { stars: 2 })], ['a', 'b', 's'], 'new', config)).toThrow('same star level')
    expect(() => mergeCards(copies, ['a', 'b', 'nope'], 'new', config)).toThrow('not in your squad')
    expect(() => mergeCards([card('a', star, { stars: 5 }), card('b', star, { stars: 5 }), card('c', star, { stars: 5 })], ['a', 'b', 'c'], 'new', config)).toThrow('top star level')
  })
})

describe('bench', () => {
  const many = Array.from({ length: 24 }, (_, index) => card(`c${index}`, grassroots))

  it('counts only the cards outside the lineup', () => {
    expect(benchCount(many, ['c0', 'c1', 'c2', 'c3', 'c4'])).toBe(19)
    expect(benchCount(many, [null, null, null, null, null])).toBe(24)
  })

  it('has room for 20, not 21', () => {
    const lineup = ['c0', 'c1', 'c2', 'c3', 'c4']
    expect(benchHasRoom(many, lineup, config)).toBe(true)
    expect(benchHasRoom(many, lineup, config, 2)).toBe(false)
  })
})
