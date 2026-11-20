import { expect, it } from 'vitest'
import { GAME_ID } from '../src'

it('is wired up', () => {
  expect(GAME_ID).toBe('pixel-pitch')
})
