import { Keyboard } from '@capacitor/keyboard'
import { useSyncExternalStore } from 'react'
import { isNativePlatform } from './platform'
import { createSharedSubscription } from './shared-subscription'

interface KeyboardSnapshot {
  isKeyboardOpen: boolean
  keyboardHeight: number
}

let snapshot: KeyboardSnapshot = { isKeyboardOpen: false, keyboardHeight: 0 }
const listeners = new Set<() => void>()

function publish(next: KeyboardSnapshot) {
  snapshot = next
  listeners.forEach(listener => listener())
}

const subscription = createSharedSubscription(async () => {
  if (!isNativePlatform())
    return () => {}

  const show = await Keyboard.addListener('keyboardWillShow', (info) => {
    publish({ isKeyboardOpen: true, keyboardHeight: info.keyboardHeight })
  })
  const hide = await Keyboard.addListener('keyboardWillHide', () => {
    publish({ isKeyboardOpen: false, keyboardHeight: 0 })
  })

  return () => {
    void show.remove()
    void hide.remove()
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

export function useKeyboard() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => snapshot)

  async function hide() {
    if (isNativePlatform())
      await Keyboard.hide()
    else if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
  }

  return { ...state, hide }
}
