import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNativePlatform } from './platform'

export type ImpactStrength = 'light' | 'medium' | 'heavy'
export type FeedbackType = 'success' | 'warning' | 'error'

const impactStyles: Record<ImpactStrength, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
}

const notificationTypes: Record<FeedbackType, NotificationType> = {
  success: NotificationType.Success,
  warning: NotificationType.Warning,
  error: NotificationType.Error,
}

function vibrateFallback(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator)
    navigator.vibrate(pattern)
}

export async function impact(strength: ImpactStrength = 'light') {
  try {
    if (isNativePlatform())
      await Haptics.impact({ style: impactStyles[strength] })
    else
      vibrateFallback(strength === 'heavy' ? 30 : strength === 'medium' ? 20 : 10)
  }
  catch {
    // Haptics are optional feedback.
  }
}

export async function notification(type: FeedbackType) {
  try {
    if (isNativePlatform())
      await Haptics.notification({ type: notificationTypes[type] })
    else
      vibrateFallback(type === 'error' ? [30, 50, 30] : 20)
  }
  catch {
    // Haptics are optional feedback.
  }
}
