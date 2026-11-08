/**
 * Seeded randomness for game rules. The same seed gives the same sequence on every device and on the server, which
 * is what lets a match be replayed from its seed and lets the app preview exactly what the server will roll.
 * Not for security: use the platform's crypto for tokens and secrets.
 */
export interface Rng {
  /** A float in [0, 1). */
  next: () => number
  /** An integer in [min, max], both included. */
  int: (min: number, max: number) => number
  pick: <T>(items: readonly T[]) => T
  /** Index of one weight, chosen in proportion to the weights. Zero weights are never chosen. */
  weighted: (weights: readonly number[]) => number
  shuffle: <T>(items: readonly T[]) => T[]
  /** An independent generator derived from this one, so adding a roll in one place cannot shift another's sequence. */
  fork: (label: string | number) => Rng
}

/** FNV-1a over the parts, joined. Turns `('club', 42, 'fixture', 7)` into a stable 32-bit seed. */
export function hashSeed(...parts: Array<string | number>): number {
  let hash = 0x811C9DC5
  for (const char of parts.join('\u001F')) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function createRng(seed: number | string): Rng {
  // mulberry32: tiny, fast, and good enough for gameplay.
  let state = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0

  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => {
      if (items.length === 0)
        throw new Error('Cannot pick from an empty list.')
      return items[Math.floor(next() * items.length)]
    },
    weighted: (weights) => {
      const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
      if (!(total > 0))
        throw new Error('At least one weight must be positive.')
      let roll = next() * total
      for (let index = 0; index < weights.length; index++) {
        roll -= Math.max(0, weights[index])
        if (roll < 0)
          return index
      }
      // Floating point left a sliver over the last positive weight.
      return weights.length - 1 - [...weights].reverse().findIndex(weight => weight > 0)
    },
    shuffle: (items) => {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index--) {
        const other = Math.floor(next() * (index + 1))
        ;[copy[index], copy[other]] = [copy[other], copy[index]]
      }
      return copy
    },
    fork: label => createRng(hashSeed(state, label)),
  }
  return rng
}

/** Number of events with mean `lambda` (Knuth). Fine for the small means of a football score. */
export function poisson(rng: Rng, lambda: number): number {
  if (!(lambda > 0))
    return 0
  const limit = Math.exp(-Math.min(lambda, 700))
  let count = 0
  let product = rng.next()
  while (product > limit) {
    count++
    product *= rng.next()
  }
  return count
}
