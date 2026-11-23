import { KeepAwake } from '@capacitor-community/keep-awake'

/**
 * Stops the screen dimming and locking while the app is open: a timer, a recipe, a game round, a scanner. Uses the
 * Screen Wake Lock API on the web, where the browser drops it when the tab is hidden and the plugin takes it back.
 * Always pair with `allowScreenSleep`, or use `useKeepAwake`. Never throws.
 */
export async function keepScreenAwake(): Promise<boolean> {
  try {
    const { isSupported } = await KeepAwake.isSupported()
    if (!isSupported)
      return false
    await KeepAwake.keepAwake()
    return true
  }
  catch {
    return false
  }
}

export async function allowScreenSleep(): Promise<void> {
  try {
    const { isSupported } = await KeepAwake.isSupported()
    if (isSupported)
      await KeepAwake.allowSleep()
  }
  catch {
    // Nothing to undo.
  }
}
