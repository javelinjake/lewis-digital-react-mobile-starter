import { Browser } from '@capacitor/browser'
import { isNativePlatform } from './platform'

/**
 * Opens a web page over the app: SFSafariViewController on iOS, a Custom Tab on Android, a new tab on the web.
 * Use it for terms, privacy, help and payment pages, so the user comes back to the app with one tap. On native the
 * page cannot read the app's storage or cookies.
 */
export async function openInAppBrowser(url: string): Promise<void> {
  if (!isNativePlatform()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  await Browser.open({ url, presentationStyle: 'popover' })
}

/** Closes the in-app browser if it is open. No-op on the web. */
export async function closeInAppBrowser(): Promise<void> {
  if (!isNativePlatform())
    return
  await Browser.close().catch(() => undefined)
}

/** Calls back when the user closes the in-app browser. Returns a function that stops listening. No-op on the web. */
export function onInAppBrowserClosed(callback: () => void): () => void {
  if (!isNativePlatform())
    return () => {}
  const handle = Browser.addListener('browserFinished', callback)
  return () => {
    void handle.then(listener => listener.remove()).catch(() => {})
  }
}
