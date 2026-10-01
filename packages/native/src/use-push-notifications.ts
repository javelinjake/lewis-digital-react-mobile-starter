import type { ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { useEffect, useRef, useState } from 'react'
import { isNativePlatform } from './platform'

export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

export interface PushHandlers {
  onToken?: (token: string) => void
  onNotification?: (notification: PushNotificationSchema) => void
  onAction?: (action: ActionPerformed) => void
  onError?: (error: unknown) => void
}

export function usePushNotifications(handlers: PushHandlers = {}) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const [permission, setPermission] = useState<PushPermission>(isNativePlatform() ? 'prompt' : 'unsupported')
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!isNativePlatform())
      return

    const handles = [
      PushNotifications.addListener('registration', ({ value }) => {
        setToken(value)
        handlersRef.current.onToken?.(value)
      }),
      PushNotifications.addListener('registrationError', error => handlersRef.current.onError?.(error)),
      PushNotifications.addListener('pushNotificationReceived', notification => handlersRef.current.onNotification?.(notification)),
      PushNotifications.addListener('pushNotificationActionPerformed', action => handlersRef.current.onAction?.(action)),
    ]

    return () => {
      handles.forEach(handle => void handle.then(item => item.remove()).catch(() => {}))
    }
  }, [])

  async function register(): Promise<PushPermission> {
    if (!isNativePlatform())
      return 'unsupported'

    let status = await PushNotifications.checkPermissions()
    if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale')
      status = await PushNotifications.requestPermissions()

    const next: PushPermission = status.receive === 'granted' ? 'granted' : 'denied'
    setPermission(next)
    if (next === 'granted')
      await PushNotifications.register()

    return next
  }

  return { permission, token, register }
}
