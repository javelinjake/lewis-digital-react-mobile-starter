import type { PushPermission } from '@ld/native/push'
import { isNativePlatform } from '@ld/native'
import { getApi } from '@/lib/api/client'
import { appMeta } from '../../../app.meta'

/**
 * Remote push, wired to the backend. Off until `capabilities.push` is on in app.meta.ts (see docs/native-release.md
 * for the Firebase setup). `@ld/native/push` is loaded only when it is on, so an app without push never bundles it.
 */
export const pushAvailable = Boolean((appMeta.capabilities as { push?: boolean }).push) && isNativePlatform() && import.meta.env.VITE_DATA_MODE === 'live'

const loadPush = () => import('@ld/native/push')

let currentToken: string | null = null

async function sendToken(token: string) {
  const push = await loadPush()
  const platform = push.pushPlatform()
  if (!platform)
    return
  await getApi().push.register({ token, platform, appVersion: import.meta.env.VITE_APP_VERSION })
  currentToken = token
}

/** Asks for permission (once; explain why first) and registers this device with the api. */
export async function enablePushNotifications(): Promise<PushPermission> {
  if (!pushAvailable)
    return 'unsupported'
  const push = await loadPush()
  const { permission, token } = await push.enablePush()
  if (token)
    await sendToken(token)
  return permission
}

export async function checkPushNotifications(): Promise<PushPermission> {
  if (!pushAvailable)
    return 'unsupported'
  return (await loadPush()).checkPushPermission()
}

export function sendTestPush() {
  return getApi().push.sendTest()
}

/** Call before signing out, while the session still exists, so this phone stops getting the account's pushes. */
export async function forgetPushDevice() {
  if (!pushAvailable || !currentToken)
    return
  await getApi().push.unregister(currentToken).catch(() => undefined)
  currentToken = null
}

/**
 * For the app's lifetime: sends rotated tokens to the api, re-registers on launch when already allowed (so a
 * reinstall or a new sign-in on this phone is picked up), and opens `data.path` when a notification is tapped.
 */
export function startPushRuntime(navigate: (path: string) => void): () => void {
  if (!pushAvailable)
    return () => {}

  let stopped = false
  let stop = () => {}
  void loadPush().then(async (push) => {
    if (stopped)
      return
    const stops = [
      push.onPushToken(token => void sendToken(token).catch(() => undefined)),
      push.onPushTapped((message) => {
        // Only paths inside the app; a notification is not allowed to send the app anywhere else.
        if (message.data.path?.startsWith('/') && !message.data.path.startsWith('//'))
          navigate(message.data.path)
      }),
    ]
    stop = () => stops.forEach(item => item())

    if (await push.checkPushPermission() === 'granted') {
      const { token } = await push.enablePush()
      if (token && !stopped)
        await sendToken(token).catch(() => undefined)
    }
  })

  return () => {
    stopped = true
    stop()
  }
}
