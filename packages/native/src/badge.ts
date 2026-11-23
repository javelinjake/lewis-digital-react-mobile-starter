import { Badge } from '@capawesome/capacitor-badge'

export type BadgeResult = 'set' | 'denied' | 'unsupported'

/**
 * Sets the number on the app icon (or the installed PWA's icon through the Badging API). On iOS the badge rides on
 * notification permission: until the user has allowed notifications this returns `denied` without asking, so the
 * permission prompt stays where the app chose to put it. Zero clears the badge. Never throws.
 */
export async function setAppBadge(count: number): Promise<BadgeResult> {
  try {
    const { isSupported } = await Badge.isSupported()
    if (!isSupported)
      return 'unsupported'
    const { display } = await Badge.checkPermissions()
    if (display !== 'granted')
      return 'denied'
    if (count <= 0)
      await Badge.clear()
    else
      await Badge.set({ count: Math.floor(count) })
    return 'set'
  }
  catch {
    return 'unsupported'
  }
}

export async function clearAppBadge(): Promise<void> {
  await setAppBadge(0)
}
