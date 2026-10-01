import { describe, expect, it } from 'vitest'
import { persistDehydrateOptions } from '../src/query/index'

describe('query persistence', () => {
  it('does not dehydrate mutations into the query cache', () => {
    expect(persistDehydrateOptions.shouldDehydrateMutation()).toBe(false)
  })
})
