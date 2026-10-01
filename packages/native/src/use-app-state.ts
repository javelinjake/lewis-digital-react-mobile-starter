import type { PluginListenerHandle } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { createSharedSubscription } from './shared-subscription'

let isActive = true
const listeners = new Set<() => void>()
const resumeListeners = new Set<() => void>()
const pauseListeners = new Set<() => void>()

function publish(next: boolean) {
  isActive = next
  listeners.forEach(listener => listener())
}

const subscription = createSharedSubscription(async () => {
  const handles: PluginListenerHandle[] = []
  handles.push(await App.addListener('appStateChange', ({ isActive: next }) => {
    publish(next)
  }))
  handles.push(await App.addListener('resume', () => {
    publish(true)
    resumeListeners.forEach(listener => listener())
  }))
  handles.push(await App.addListener('pause', () => {
    publish(false)
    pauseListeners.forEach(listener => listener())
  }))

  return () => {
    handles.forEach(handle => void handle.remove())
  }
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  const release = subscription.subscribe()
  return () => {
    listeners.delete(listener)
    release()
  }
}

export function useAppState() {
  const active = useSyncExternalStore(subscribe, () => isActive, () => true)

  const onResume = useCallback((callback: () => void) => {
    resumeListeners.add(callback)
    return () => {
      resumeListeners.delete(callback)
    }
  }, [])

  const onPause = useCallback((callback: () => void) => {
    pauseListeners.add(callback)
    return () => {
      pauseListeners.delete(callback)
    }
  }, [])

  return { isActive: active, onResume, onPause }
}

/** Keeps the shared app listener alive while any caller is mounted. */
export function useAppStateSubscription() {
  useEffect(() => subscribe(() => {}), [])
}
