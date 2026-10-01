import { describe, expect, it } from 'vitest'
import { createSharedSubscription } from '../src/shared-subscription'

describe('createSharedSubscription', () => {
  it('starts once for many subscribers and stops after the last release', async () => {
    let active = 0
    const subscription = createSharedSubscription(async () => {
      active += 1
      return () => {
        active -= 1
      }
    })

    const releaseA = subscription.subscribe()
    const releaseB = subscription.subscribe()
    await Promise.resolve()
    await Promise.resolve()
    expect(active).toBe(1)

    releaseA()
    await Promise.resolve()
    expect(active).toBe(1)

    releaseB()
    await Promise.resolve()
    await Promise.resolve()
    expect(active).toBe(0)
  })

  it('cleans up a start that resolves after Strict Mode unmount', async () => {
    let active = 0
    let resolveStart: (stop: () => void) => void = () => {}
    const subscription = createSharedSubscription(() => new Promise((resolve) => {
      resolveStart = (stop) => {
        active += 1
        resolve(stop)
      }
    }))

    const release = subscription.subscribe()
    release()
    resolveStart(() => {
      active -= 1
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(subscription.subscriberCount()).toBe(0)
    expect(active).toBe(0)
  })
})
