import { StatusBar, Style } from '@capacitor/status-bar'
import { isAndroid, isNativePlatform } from './platform'

export interface StatusBarAppearance {
  light: boolean
  backgroundColor?: string
}

export async function setStatusBarAppearance(appearance: StatusBarAppearance) {
  if (!isNativePlatform())
    return

  await StatusBar.setStyle({ style: appearance.light ? Style.Dark : Style.Light })

  if (isAndroid() && appearance.backgroundColor)
    await StatusBar.setBackgroundColor({ color: appearance.backgroundColor })
}
