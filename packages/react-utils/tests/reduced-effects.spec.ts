import { describe, expect, it } from 'vitest'
import { shouldReduceEffects } from '../src/reduced-effects'

describe('shouldReduceEffects', () => {
  it('is on or off when the person says so, whatever the device is', () => {
    expect(shouldReduceEffects('on', { deviceMemory: 8, hardwareConcurrency: 8 })).toBe(true)
    expect(shouldReduceEffects('off', { deviceMemory: 1, prefersReducedMotion: true })).toBe(false)
  })

  it('on auto, follows the operating system\'s reduced-motion setting', () => {
    expect(shouldReduceEffects('auto', { prefersReducedMotion: true, deviceMemory: 8, hardwareConcurrency: 8 })).toBe(true)
  })

  it('on auto, turns on for a weak Android phone: 2 GB or less, or 4 cores or fewer', () => {
    expect(shouldReduceEffects('auto', { deviceMemory: 2 })).toBe(true)
    expect(shouldReduceEffects('auto', { deviceMemory: 1 })).toBe(true)
    expect(shouldReduceEffects('auto', { hardwareConcurrency: 4 })).toBe(true)
    expect(shouldReduceEffects('auto', { deviceMemory: 4, hardwareConcurrency: 8 })).toBe(false)
  })

  it('on auto, stays full effects when the device reports nothing (an iPhone does not expose these)', () => {
    expect(shouldReduceEffects('auto', {})).toBe(false)
  })
})
