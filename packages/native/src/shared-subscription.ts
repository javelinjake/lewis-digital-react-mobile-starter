/**
 * Reference-counted async start/stop so React Strict Mode can mount,
 * unmount, and mount again without leaking native listeners.
 */
export function createSharedSubscription(start: () => Promise<() => Promise<void> | void>) {
  let subscribers = 0
  let cleanup: (() => Promise<void> | void) | null = null
  let starting: Promise<void> | null = null

  function subscribe() {
    subscribers += 1

    if (subscribers === 1) {
      starting = Promise.resolve()
        .then(() => start())
        .then((stop) => {
          if (subscribers === 0) {
            cleanup = null
            return stop()
          }
          cleanup = stop
        })
        .catch(() => {})
    }

    let released = false

    return () => {
      if (released)
        return
      released = true
      subscribers -= 1

      if (subscribers > 0)
        return

      const pending = starting
      void pending?.then(() => {
        if (subscribers === 0 && cleanup) {
          const stop = cleanup
          cleanup = null
          void stop()
        }
      })
    }
  }

  return {
    subscribe,
    subscriberCount: () => subscribers,
  }
}
