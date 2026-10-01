import { Capacitor } from '@capacitor/core'

export type NativePlatform = 'ios' | 'android' | 'web'

export function getPlatform(): NativePlatform {
  return Capacitor.getPlatform() as NativePlatform
}

/** True when running inside the iOS or Android Capacitor shell. */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

export function isIos(): boolean {
  return getPlatform() === 'ios'
}

export function isAndroid(): boolean {
  return getPlatform() === 'android'
}

export function isPluginAvailable(name: string): boolean {
  return Capacitor.isPluginAvailable(name)
}
