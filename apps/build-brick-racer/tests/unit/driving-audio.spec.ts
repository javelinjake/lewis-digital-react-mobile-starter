import { describe, expect, it } from 'vitest'
import { audio, busGains, engineLevel, enginePitch, sfx, slideLevel } from '@/lib/audio'

describe('audio volume mapping', () => {
  it('scales buses by the sliders and silences everything when muted', () => {
    const loud = busGains({ music: 1, effects: 1, muted: false })
    const quiet = busGains({ music: 0.3, effects: 0.3, muted: false })
    expect(loud.effects).toBeGreaterThan(quiet.effects)
    expect(loud.music).toBeGreaterThan(quiet.music)
    expect(busGains({ music: 1, effects: 1, muted: true })).toEqual({ effects: 0, music: 0 })
    expect(busGains({ music: 0, effects: 0, muted: false })).toEqual({ effects: 0, music: 0 })
  })

  it('keeps music quieter than effects at equal settings and clamps bad values', () => {
    const g = busGains({ music: 1, effects: 1, muted: false })
    expect(g.music).toBeLessThan(g.effects)
    expect(busGains({ music: 7, effects: -2, muted: false }).effects).toBe(0)
    expect(busGains({ music: Number.NaN, effects: 0.5, muted: false }).music).toBe(0)
  })

  it('raises engine pitch and level with speed and throttle, and only hisses while sliding', () => {
    expect(enginePitch(4, 0)).toBeGreaterThan(enginePitch(1, 0))
    expect(enginePitch(2, 1)).toBeGreaterThan(enginePitch(2, 0))
    expect(engineLevel(5, 1)).toBeGreaterThan(engineLevel(0, 0))
    expect(slideLevel(false, 5)).toBe(0)
    expect(slideLevel(true, 5)).toBeGreaterThan(0)
  })

  it('does nothing and does not throw before a user gesture unlocks audio', () => {
    expect(audio.unlocked).toBe(false)
    expect(() => {
      audio.apply({ music: 0.5, effects: 0.5, muted: false })
      sfx.tap()
      sfx.snap()
      sfx.error()
      sfx.thud(0.5)
      sfx.splash()
      sfx.finish()
      sfx.countdown(3)
    }).not.toThrow()
  })
})
