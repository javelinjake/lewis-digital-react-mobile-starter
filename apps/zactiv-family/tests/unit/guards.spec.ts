import { beforeEach, describe, expect, it } from 'vitest'
import { ONBOARDING_KEY } from '@/lib/family-data'
import { destinationFor } from '@/lib/navigation'

describe('auth destination', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('sends anonymous visitors to login', () => {
    expect(destinationFor('anonymous', '/workouts')).toBe('/login')
  })

  it('sends a new account to welcome, except a video', () => {
    expect(destinationFor('authenticated', '/')).toBe('/welcome')
    expect(destinationFor('authenticated', '/videos/4')).toBe('/videos/4')
  })

  it('lets an onboarded family through', () => {
    window.localStorage.setItem(ONBOARDING_KEY, 'true')
    expect(destinationFor('authenticated', '/journal')).toBe('/journal')
  })
})
