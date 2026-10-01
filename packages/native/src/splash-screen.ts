import { SplashScreen } from '@capacitor/splash-screen'
import { isNativePlatform } from './platform'

/** Call once the first route is ready. No-op on the web. */
export async function hideSplashScreen() {
  if (isNativePlatform())
    await SplashScreen.hide({ fadeOutDuration: 200 })
}
