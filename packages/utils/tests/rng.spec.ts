import { describe, expect, it } from 'vitest'
import { createRng, hashSeed, poisson } from '../src/random/rng'

describe('createRng', () => {
  it('gives the same sequence for the same seed, whether a number or a string', () => {
    const a = createRng(123)
    const b = createRng(123)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
    expect(createRng('club-1-fixture-7').next()).toBe(createRng('club-1-fixture-7').next())
  })

  it('gives different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  it('keeps floats in [0, 1) and integers inside the range, both ends reachable', () => {
    const rng = createRng(7)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      seen.add(rng.int(3, 6))
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6])
  })

  it('picks uniformly and refuses an empty list', () => {
    const rng = createRng(9)
    const counts = { a: 0, b: 0, c: 0 }
    for (let i = 0; i < 6000; i++)
      counts[rng.pick(['a', 'b', 'c'] as const)]++
    for (const count of Object.values(counts))
      expect(count).toBeGreaterThan(1800)
    expect(() => rng.pick([])).toThrow('empty')
  })

  it('chooses by weight, never picks a zero weight, and rejects all-zero weights', () => {
    const rng = createRng(11)
    const counts = [0, 0, 0]
    for (let i = 0; i < 10_000; i++)
      counts[rng.weighted([70, 30, 0])]++
    expect(counts[2]).toBe(0)
    expect(counts[0] / 10_000).toBeGreaterThan(0.67)
    expect(counts[0] / 10_000).toBeLessThan(0.73)
    expect(() => rng.weighted([0, 0])).toThrow('positive')
  })

  it('shuffles without losing or duplicating anything, and without touching the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const result = createRng(5).shuffle(input)
    expect([...result].sort((x, y) => x - y)).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('forks independent streams, so one extra roll cannot shift another sequence', () => {
    const a = createRng(1)
    const b = createRng(1)
    a.next()
    expect(a.fork('match').next()).not.toBe(b.fork('match').next())
    const c = createRng(1)
    const d = createRng(1)
    expect(c.fork('match').next()).toBe(d.fork('match').next())
    expect(c.fork('match').next()).not.toBe(c.fork('packs').next())
  })
})

describe('hashSeed', () => {
  it('is stable, order sensitive, and does not confuse different splits of the same characters', () => {
    expect(hashSeed('club', 42)).toBe(hashSeed('club', 42))
    expect(hashSeed('a', 'b')).not.toBe(hashSeed('b', 'a'))
    expect(hashSeed('ab', 'c')).not.toBe(hashSeed('a', 'bc'))
  })
})

describe('poisson', () => {
  it('matches the mean and variance of the distribution', () => {
    const rng = createRng(2026)
    const samples = Array.from({ length: 20_000 }, () => poisson(rng, 1.8))
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
    const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length
    expect(mean).toBeGreaterThan(1.75)
    expect(mean).toBeLessThan(1.85)
    expect(variance).toBeGreaterThan(1.7)
    expect(variance).toBeLessThan(1.9)
  })

  it('returns zero for a non-positive mean', () => {
    expect(poisson(createRng(1), 0)).toBe(0)
    expect(poisson(createRng(1), -3)).toBe(0)
  })
})
