import { describe, expect, it } from 'vitest'
import { bearerValue, secretMatches } from '../../src/secret'

describe('secretMatches', () => {
  it('matches only identical non-empty secrets', () => {
    expect(secretMatches('abc', 'abc')).toBe(true)
    expect(secretMatches('abd', 'abc')).toBe(false)
  })

  it('never matches an empty or missing secret', () => {
    expect(secretMatches('', '')).toBe(false)
    expect(secretMatches(undefined, 'abc')).toBe(false)
    expect(secretMatches('abc', undefined)).toBe(false)
  })
})

describe('bearerValue', () => {
  it('accepts a Bearer prefix or a bare value', () => {
    expect(bearerValue('Bearer s3cret')).toBe('s3cret')
    expect(bearerValue('s3cret')).toBe('s3cret')
    expect(bearerValue(undefined)).toBeUndefined()
    expect(bearerValue('Bearer ')).toBeUndefined()
  })
})
