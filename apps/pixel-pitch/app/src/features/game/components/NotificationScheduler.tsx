import { isNativePlatform } from '@ld/native'
import { useEffect } from 'react'
import { useNotificationSettings } from '@/hooks/use-notification-settings'
import { buildNotificationPlans } from '../lib/notification-plans'
import { useClub, useGameConfig } from '../queries/use-game'

/**
 * Keeps the phone's local alerts in step with the club: the shelf filling, the next match being played and the trays
 * filling. The times come from the same rules the server uses, so an alert fires when the thing has really happened.
 * It rebuilds the whole schedule whenever the club changes; the phone's alerts are replaced, never stacked. Nothing
 * happens on the web.
 */
export function NotificationScheduler() {
  const club = useClub()
  const config = useGameConfig()
  const [enabled] = useNotificationSettings()
  const game = club.data

  useEffect(() => {
    if (!game || !isNativePlatform())
      return
    const plans = buildNotificationPlans(game, config)
    void import('@ld/native/notifications').then(({ rescheduleLocalNotifications }) => rescheduleLocalNotifications(plans, { enabledTypes: enabled }))
  }, [game, config, enabled])

  return null
}
