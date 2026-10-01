import { describe, expect, it } from 'vitest'
import { retry } from '../src/async/retry'
import { formatMoney } from '../src/money/format-money'
import { omitEmpty } from '../src/object/omit-empty'
import { slugify } from '../src/string/slugify'

describe('retry', () => {
  it('retries until success', async () => {
    let calls = 0
    const result = await retry(async () => {
      calls++
      if (calls < 2)
        throw new Error('fail')
      return 'ok'
    }, { attempts: 3, delayMs: 1 })

    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  it('throws after exhausting attempts', async () => {
    await expect(retry(async () => {
      throw new Error('fail')
    }, { attempts: 2, delayMs: 1 })).rejects.toThrow('fail')
  })
})

describe('slugify', () => {
  it('converts strings to slugs', () => {
    expect(slugify('Hello World!')).toBe('hello-world')
    expect(slugify('  Foo_Bar  ')).toBe('foo-bar')
  })
})

describe('formatMoney', () => {
  it('formats currency values', () => {
    expect(formatMoney(1234.5, { currency: 'GBP', locale: 'en-GB' })).toContain('1,234')
  })
})

describe('omitEmpty', () => {
  it('removes empty values', () => {
    expect(omitEmpty({ a: 1, b: '', c: null, d: undefined, e: 'x' })).toEqual({ a: 1, e: 'x' })
  })
})
