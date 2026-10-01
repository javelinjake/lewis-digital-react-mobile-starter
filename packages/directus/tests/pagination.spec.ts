import { describe, expect, it } from 'vitest'
import { getPageRange, getTotalPages } from '../src/pagination'

describe('pagination helpers', () => {
  it('calculates total pages', () => {
    expect(getTotalPages(50, 10)).toBe(5)
    expect(getTotalPages(0, 10)).toBe(1)
  })

  it('calculates page range', () => {
    expect(getPageRange({
      data: [],
      total: 50,
      page: 2,
      limit: 10,
      totalPages: 5,
    })).toEqual({ from: 11, to: 20 })
  })
})
