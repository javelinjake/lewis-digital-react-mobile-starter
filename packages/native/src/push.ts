import { FirebaseMessaging, type Notification } from '@capacitor-firebase/messaging'
import { useEffect, useRef, useState } from 'react'
import { getPlatform, isNativePlatform } from './platform'

/**
 * Remote push through Firebase Cloud Messaging, on iOS (via APNs) and Android. Needs `capabilities.push` in
 * app.meta.ts, `@capacitor-firebase/messaging` in the app's package.json and the Firebase files in
 * `firebase/<env>/` (docs/native-release.md). The token this returns is what the backend's `/actions/push/register`
 * stores. Web push is not supported: every function reports `unsupported` there.
 *
 * Import this entry lazily (`await import('@ld/native/push')`) from code that runs only when the capability is on,
 * so apps without push never bundle it.
 */

export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

export interface PushMessage {
  title?: string
  body?: string
  /** The `data` the server sent, e.g. `{ path: '/notes/12' }`. Strings only. */
  data: Record<string, string>
}

function toMessage(notification: Notification): PushMessage {
  const data = notification.data && typeof notification.data === 'object' ? notification.data as Record<string, unknown> : {}
  return {
    title: notification.title,
    body: notification.body,
    data: Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'string')) as Record<string, string>,
  }
}

export async function checkPushPermission(): Promise<PushPermission> {
  if (!isNativePlatform())
    return 'unsupported'
  try {
    const { receive } = await FirebaseMessaging.checkPermissions()
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt'
  }
  catch {
    return 'unsupported'
  }
}

/**
 * Asks for permission (the OS prompt, once) and returns the device's push token. Ask after explaining why, from a
 * button: a prompt on first launch is mostly declined, and iOS never asks twice. Never throws.
 */
export async function enablePush(): Promise<{ permission: PushPermission, token: string | null }> {
  if (!isNativePlatform())
    return { permission: 'unsupported', token: null }
  try {
    let { receive } = await FirebaseMessaging.checkPermissions()
    if (receive !== 'granted' && receive !== 'denied')
      receive = (await FirebaseMessaging.requestPermissions()).receive
    if (receive !== 'granted')
      return { permission: 'denied', token: null }
    const { token } = await FirebaseMessaging.getToken()
    return { permission: 'granted', token: token || null }
  }
  catch {
    // Most often: the Firebase files for this environment were not added before the build.
    return { permission: 'unsupported', token: null }
  }
}

/** Forgets this device's token, so nothing more arrives until `enablePush` again. Pair with the api's unregister. */
export async function disablePush(): Promise<void> {
  if (!isNativePlatform())
    return
  await FirebaseMessaging.deleteToken().catch(() => undefined)
}

export function pushPlatform(): 'ios' | 'android' | null {
  const platform = getPlatform()
  return platform === 'web' ? null : platform
}

function listen(start: () => Promise<{ remove: () => Promise<void> }>): () => void {
  if (!isNativePlatform())
    return () => {}
  const handle = start()
  return () => {
    void handle.then(listener => listener.remove()).catch(() => {})
  }
}

/** Firebase rotates tokens. Send each new one to the api. Returns a function that stops listening. */
export function onPushToken(callback: (token: string) => void): () => void {
  return listen(() => FirebaseMessaging.addListener('tokenReceived', ({ token }) => callback(token)))
}

/** A push arrived while the app was open. The OS still shows it (the banner options are in capacitor.config). */
export function onPushReceived(callback: (message: PushMessage) => void): () => void {
  return listen(() => FirebaseMessaging.addListener('notificationReceived', ({ notification }) => callback(toMessage(notification))))
}

/** The person tapped a notification. Route with `message.data`, e.g. to `data.path`. */
export function onPushTapped(callback: (message: PushMessage) => void): () => void {
  return listen(() => FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => callback(toMessage(notification))))
}

export interface PushHandlers {
  onToken?: (token: string) => void
  onNotification?: (message: PushMessage) => void
  onTap?: (message: PushMessage) => void
}

/**
 * The permission, the current token and `register()` (which asks and fetches the token), plus listeners for the
 * component's lifetime. `onToken` fires for the first token and for every rotation: send it to the api there.
 */
export function usePushNotifications(handlers: PushHandlers = {}) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const [permission, setPermission] = useState<PushPermission>(isNativePlatform() ? 'prompt' : 'unsupported')
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void checkPushPermission().then((next) => {
      if (!cancelled)
        setPermission(next)
    })
    const stops = [
      onPushToken((next) => {
        setToken(next)
        handlersRef.current.onToken?.(next)
      }),
      onPushReceived(message => handlersRef.current.onNotification?.(message)),
      onPushTapped(message => handlersRef.current.onTap?.(message)),
    ]
    return () => {
      cancelled = true
      stops.forEach(stop => stop())
    }
  }, [])

  async function register(): Promise<PushPermission> {
    const result = await enablePush()
    setPermission(result.permission)
    if (result.token) {
      setToken(result.token)
      handlersRef.current.onToken?.(result.token)
    }
    return result.permission
  }

  return { permission, token, register }
}
