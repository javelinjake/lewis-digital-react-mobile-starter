import type { NotificationPlan, NotificationPolicy } from './notification-plan'
import { LocalNotifications } from '@capacitor/local-notifications'
import { planNotifications } from './notification-plan'
import { isNativePlatform } from './platform'

export type { NotificationPlan, NotificationPolicy } from './notification-plan'
export { DEFAULT_MAX_PER_DAY, DEFAULT_QUIET_HOURS, planNotifications } from './notification-plan'

export type NotificationPermission = 'granted' | 'denied' | 'prompt'

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!isNativePlatform())
    return 'denied'
  const { display } = await LocalNotifications.checkPermissions()
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
}

/** Ask at a moment that makes sense (after the first rip, not at launch), not on first open. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNativePlatform())
    return 'denied'
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
}

export async function cancelLocalNotifications() {
  if (!isNativePlatform())
    return
  const { notifications } = await LocalNotifications.getPending()
  if (notifications.length > 0)
    await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) })
}

/**
 * Replaces every pending alert with the ones `policy` allows. Call it when the app goes to the background and again
 * after each sync on resume: the state in the app is the source of truth, so the schedule is always rebuilt from it.
 * Returns what was scheduled.
 */
export async function rescheduleLocalNotifications(plans: readonly NotificationPlan[], policy: NotificationPolicy = {}) {
  if (!isNativePlatform())
    return []

  await cancelLocalNotifications()
  if (await getNotificationPermission() !== 'granted')
    return []

  const allowed = planNotifications(plans, policy)
  if (allowed.length > 0) {
    await LocalNotifications.schedule({
      notifications: allowed.map(plan => ({
        id: plan.id,
        title: plan.title,
        body: plan.body,
        schedule: { at: new Date(plan.at), allowWhileIdle: true },
        extra: { type: plan.type },
      })),
    })
  }
  return allowed
}
